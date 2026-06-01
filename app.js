const components = [

{
    name:"3/8 Stainless Bolt",
    category:"Fasteners",
    stock:12,
    minimum:25,
    location:"A2-B4",
    image:"images/placeholder.png"
},

{
    name:"AC Disconnect",
    category:"Power",
    stock:6,
    minimum:5,
    location:"C1-D2",
    image:"images/placeholder.png"
},

{
    name:"Antenna Mount",
    category:"RF",
    stock:30,
    minimum:15,
    location:"B2-A1",
    image:"images/placeholder.png"
}

];

const dashboardView =
document.getElementById("dashboardView");

const categoryView =
document.getElementById("categoryView");

const inventoryView =
document.getElementById("inventoryView");

document
.querySelectorAll(".openCategory")
.forEach(button=>{

button.addEventListener("click",()=>{

const category =
button.dataset.category;

showCategory(category);

});

});

function showCategory(category){

dashboardView.classList.add("hidden");
categoryView.classList.remove("hidden");

document.getElementById(
"categoryTitle"
).innerText = category;

const grid =
document.getElementById(
"componentGrid"
);

grid.innerHTML="";

components
.filter(c=>c.category===category)
.forEach(component=>{

grid.innerHTML += `

<div class="component-card">

<img src="${component.image}">

<div class="component-info">

<h3>${component.name}</h3>

<p>Stock:
${component.stock}</p>

<p>Location:
${component.location}</p>

</div>

</div>

`;

});

}

document
.getElementById("backBtn")
.addEventListener("click",()=>{

categoryView.classList.add("hidden");

dashboardView.classList.remove(
"hidden"
);

});

document
.getElementById("inventoryBtn")
.addEventListener("click",()=>{

dashboardView.classList.add("hidden");
categoryView.classList.add("hidden");

inventoryView.classList.remove(
"hidden"
);

loadTable();

});

document
.getElementById("dashboardBtn")
.addEventListener("click",()=>{

inventoryView.classList.add("hidden");
categoryView.classList.add("hidden");

dashboardView.classList.remove(
"hidden"
);

});

function loadTable(){

const tbody =
document.getElementById(
"inventoryTable"
);

tbody.innerHTML="";

components.forEach(component=>{

tbody.innerHTML += `

<tr class="${
component.stock <
component.minimum
?
'low-stock'
:
''
}">

<td>${component.name}</td>
<td>${component.category}</td>
<td>${component.stock}</td>
<td>${component.minimum}</td>
<td>${component.location}</td>

</tr>

`;

});

}