const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

admin.initializeApp();

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

const FROM_EMAIL = "jbrecknock@adb-us.com";
const AJ_EMAIL = "ajkwasek@adb-us.com";
const NICK_EMAIL = "nharbacek@adb-us.com";

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago"
  });
}

async function sendEmail({ to, cc, subject, text }) {
  await sgMail.send({
    to,
    cc,
    from: FROM_EMAIL,
    subject,
    text
  });
}

exports.sendCheckoutConfirmation = onDocumentCreated(
  {
    document: "checkouts/{checkoutId}",
    secrets: [SENDGRID_API_KEY]
  },
  async event => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    const checkout = event.data.data();

    await sendEmail({
      to: checkout.email,
      subject: `Tool Checkout Confirmation: ${checkout.tool}`,
      text:
`This confirms your ADB tool checkout.

Tool: ${checkout.tool}
Name: ${checkout.name}
Phone: ${checkout.phoneFormatted}
Expected Return: ${formatDate(new Date(checkout.expectedReturnAt))} by 5:00 PM

Please return the tool on time or extend the rental before the return date.`
    });
  }
);

exports.sendScheduledToolReminders = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "America/Chicago",
    secrets: [SENDGRID_API_KEY]
  },
  async () => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    const now = new Date();

    const snapshot = await admin
      .firestore()
      .collection("checkouts")
      .where("status", "==", "out")
      .get();

    const updates = [];

    for (const docSnap of snapshot.docs) {
      const checkout = docSnap.data();
      const ref = docSnap.ref;

      const expected = new Date(checkout.expectedReturnAt);

      const reminder24 = new Date(expected);
      reminder24.setDate(reminder24.getDate() - 1);
      reminder24.setHours(17, 0, 0, 0);

      const returnDay = new Date(expected);
      returnDay.setHours(9, 0, 0, 0);

      const lateNotice = new Date(expected);
      lateNotice.setDate(lateNotice.getDate() + 1);
      lateNotice.setHours(9, 0, 0, 0);

      if (!checkout.reminder24Sent && now >= reminder24) {
        await sendEmail({
          to: checkout.email,
          subject: `REMINDER: 24 hours to return ${checkout.tool}`,
          text:
`REMINDER: You have about 24 hours to return "${checkout.tool}" or extend the checkout.

Tool: ${checkout.tool}
Expected Return: ${formatDate(expected)} by 5:00 PM`
        });

        updates.push(ref.update({ reminder24Sent: true }));
      }

      if (!checkout.reminderReturnDaySent && now >= returnDay) {
        await sendEmail({
          to: checkout.email,
          subject: `FINAL REMINDER: ${checkout.tool} is due today`,
          text:
`FINAL REMINDER: "${checkout.tool}" is due back today by 5:00 PM.

Please return the tool or extend the checkout.`
        });

        updates.push(ref.update({ reminderReturnDaySent: true }));
      }

      if (!checkout.lateNoticeSent && now >= lateNotice) {
        await sendEmail({
          to: checkout.email,
          cc: [AJ_EMAIL, NICK_EMAIL],
          subject: `LATE NOTICE: ${checkout.tool} was not returned`,
          text:
`LATE NOTICE: "${checkout.tool}" was not returned by the expected deadline.

Tool: ${checkout.tool}
Checked Out By: ${checkout.name}
Worker Email: ${checkout.email}
Phone: ${checkout.phoneFormatted}
Expected Return: ${formatDate(expected)} by 5:00 PM

Please return this tool immediately or update the checkout.`
        });

        updates.push(ref.update({ lateNoticeSent: true }));
      }
    }

    await Promise.all(updates);
  }
);
