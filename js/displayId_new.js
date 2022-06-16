function displayId() {
var rows = document.querySelectorAll("#t1 tr");
var theArray = Array.from(rows);

theArray.forEach(tr => {
  var td = tr.querySelector("td:nth-child(4)");
    td.innerHTML += "<br><br> ID:" + tr.id;
});
}
