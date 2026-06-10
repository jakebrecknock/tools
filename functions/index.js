const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

admin.initializeApp();

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

const FROM_EMAIL = "jbrecknock@adb-us.com";

const AJ_EMAIL = "ajkwasek@adb-us.com";
const NICK_EMAIL = "nhharbacek@adb-us.com";
const DEREK_EMAIL = "derek.pleva@adb-us.com";
const EVAN_EMAIL = "eebay@adb-us.com";

const SUPERVISOR_EMAILS = [AJ_EMAIL, NICK_EMAIL, DEREK_EMAIL, EVAN_EMAIL];

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago"
  });
}

function formatDateTime(date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago"
  });
}

async function sendEmail({ to, cc, subject, text }) {
  const message = {
    to,
    from: FROM_EMAIL,
    subject,
    text
  };

  if (cc) message.cc = cc;

  await sgMail.send(message);
}

function checkoutDetails(checkout) {
  const checkoutStart = checkout.checkoutStartAt || checkout.checkedOutAt;
  const expectedReturn = checkout.expectedReturnAt;

  return `Tool: ${checkout.tool}
Name: ${checkout.name}
Worker Email: ${checkout.email}
Phone: ${checkout.phoneFormatted || checkout.phone || ""}
Checkout Start: ${checkoutStart ? formatDateTime(new Date(checkoutStart)) : "Not listed"}
Expected Return: ${expectedReturn ? `${formatDate(new Date(expectedReturn))} by 5:00 PM` : "Not listed"}`;
}

exports.sendCheckoutConfirmation = onDocumentCreated(
  {
    document: "checkouts/{checkoutId}",
    secrets: [SENDGRID_API_KEY]
  },
  async event => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    const checkout = event.data.data();

    if (checkout.status === "scheduled") {
      await sendEmail({
        to: checkout.email,
        subject: `Tool Reservation Scheduled: ${checkout.tool}`,
        text:
`This confirms your scheduled ADB tool checkout.

${checkoutDetails(checkout)}

You do not need to do anything else to confirm this reservation. Doing nothing keeps the checkout scheduled.

If you need to cancel it, open the Tool Checkout dashboard and cancel the scheduled checkout before it begins.`
      });

      return;
    }

    await sendEmail({
      to: checkout.email,
      subject: `Tool Checkout Confirmation: ${checkout.tool}`,
      text:
`This confirms your ADB tool checkout.

${checkoutDetails(checkout)}

Please return the tool on time or extend the rental before the return date.`
    });
  }
);

exports.sendCheckoutUpdateConfirmation = onDocumentUpdated(
  {
    document: "checkouts/{checkoutId}",
    secrets: [SENDGRID_API_KEY]
  },
  async event => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    const before = event.data.before.data();
    const after = event.data.after.data();

    if (!before || !after) return;

    const returnDateChanged = before.expectedReturnAt !== after.expectedReturnAt;
    const stillOut = after.status === "out";

    if (!returnDateChanged || !stillOut) return;

    await sendEmail({
      to: after.email,
      subject: `Tool Rental Updated: ${after.tool}`,
      text:
`Your ADB tool rental has been updated.

${checkoutDetails(after)}

Your reminder emails will now follow this updated return date.`
    });
  }
);

exports.sendDamageReport = onDocumentCreated(
  {
    document: "damageReports/{reportId}",
    secrets: [SENDGRID_API_KEY]
  },
  async event => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    const report = event.data.data();

    const reporterEmail = report.email || null;
    const toList = reporterEmail ? [reporterEmail] : SUPERVISOR_EMAILS;
    const ccList = reporterEmail ? SUPERVISOR_EMAILS : null;

    await sendEmail({
      to: toList,
      cc: ccList,
      subject: `Damage/Missing Tool Report: ${report.tool || "Tool"}`,
      text:
`A damage or missing tool report was submitted.

Tool: ${report.tool || ""}
Report Type: ${report.reportType || ""}
Tool Status: ${report.toolStatus || ""}
Name: ${report.name || ""}
Email: ${report.email || ""}
Phone: ${report.phoneFormatted || report.phone || ""}

Comment:
${report.comment || ""}`
    });
  }
);

exports.sendGeneralRequest = onDocumentCreated(
  {
    document: "requests/{requestId}",
    secrets: [SENDGRID_API_KEY]
  },
  async event => {
    sgMail.setApiKey(SENDGRID_API_KEY.value());

    const request = event.data.data();

    await sendEmail({
      to: SUPERVISOR_EMAILS,
      subject: `Tool Checkout Request/Comment: ${request.type || "General Comment"}`,
      text:
`A new request/comment was submitted from the Tool Checkout System.

Type: ${request.type || ""}
Name: ${request.name || ""}
Email: ${request.email || ""}
Phone: ${request.phoneFormatted || request.phone || ""}

Comment:
${request.comment || ""}`
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

    const activeSnapshot = await admin
      .firestore()
      .collection("checkouts")
      .where("status", "==", "out")
      .get();

    const scheduledSnapshot = await admin
      .firestore()
      .collection("checkouts")
      .where("status", "==", "scheduled")
      .get();

    const updates = [];

    for (const docSnap of scheduledSnapshot.docs) {
      const checkout = docSnap.data();
      const ref = docSnap.ref;

      const start = new Date(checkout.checkoutStartAt || checkout.checkedOutAt);

      const scheduledReminder = new Date(start);
      scheduledReminder.setDate(scheduledReminder.getDate() - 1);
      scheduledReminder.setHours(9, 0, 0, 0);

      const startDay = new Date(start);
      startDay.setHours(6, 0, 0, 0);

      if (!checkout.scheduledReminderSent && now >= scheduledReminder) {
        await sendEmail({
          to: checkout.email,
          subject: `REMINDER: You have ${checkout.tool} scheduled tomorrow`,
          text:
`REMINDER: You have a scheduled ADB tool checkout coming up.

${checkoutDetails(checkout)}

You do not need to do anything to confirm. Doing nothing keeps the checkout scheduled.

If you need to cancel, open the Tool Checkout dashboard and cancel the scheduled checkout before it begins.`
        });

        updates.push(ref.update({ scheduledReminderSent: true }));
      }

      if (!checkout.startDayEmailSent && now >= startDay) {
        await sendEmail({
          to: checkout.email,
          subject: `Tool Checkout Starts Today: ${checkout.tool}`,
          text:
`Your scheduled ADB tool checkout starts today.

${checkoutDetails(checkout)}

You are responsible for this tool while it is checked out in your name.`
        });

        updates.push(
          ref.update({
            status: "out",
            checkedOutAt: start.toISOString(),
            startDayEmailSent: true,
            activatedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        );
      }
    }

    for (const docSnap of activeSnapshot.docs) {
      const checkout = docSnap.data();
      const ref = docSnap.ref;

      const expected = new Date(checkout.expectedReturnAt);

      const dayBeforeDueAt5 = new Date(expected);
      dayBeforeDueAt5.setDate(dayBeforeDueAt5.getDate() - 1);
      dayBeforeDueAt5.setHours(17, 0, 0, 0);

      const dueDayAt6 = new Date(expected);
      dueDayAt6.setHours(6, 0, 0, 0);

      const overdueAt9 = new Date(expected);
      overdueAt9.setDate(overdueAt9.getDate() + 1);
      overdueAt9.setHours(9, 0, 0, 0);

      if (!checkout.reminder24Sent && now >= dayBeforeDueAt5) {
        await sendEmail({
          to: checkout.email,
          subject: `REMINDER: ${checkout.tool} is due tomorrow`,
          text:
`REMINDER: "${checkout.tool}" is due back tomorrow by 5:00 PM.

${checkoutDetails(checkout)}

Please return the tool on time or extend the checkout before it is due.`
        });

        updates.push(ref.update({ reminder24Sent: true }));
      }

      if (!checkout.reminderReturnDaySent && now >= dueDayAt6) {
        await sendEmail({
          to: checkout.email,
          subject: `FINAL REMINDER: ${checkout.tool} is due today`,
          text:
`FINAL REMINDER: "${checkout.tool}" is due back today by 5:00 PM.

${checkoutDetails(checkout)}

Please return the tool or extend the checkout.`
        });

        updates.push(ref.update({ reminderReturnDaySent: true }));
      }

      if (!checkout.lateNoticeSent && now >= overdueAt9) {
        await sendEmail({
          to: checkout.email,
          cc: SUPERVISOR_EMAILS,
          subject: `OVERDUE TOOL: ${checkout.tool}`,
          text:
`OVERDUE NOTICE: "${checkout.tool}" was not returned by the expected deadline.

${checkoutDetails(checkout)}

Please return this tool immediately or update the checkout.`
        });

        updates.push(ref.update({ lateNoticeSent: true }));
      }
    }

    await Promise.all(updates);
  }
);