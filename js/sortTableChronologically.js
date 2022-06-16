





function sortTableChronologically() {
  //Get all the rows in the table into an Array//
  var rows = document.querySelectorAll("#t1 tr");
  var theArray = Array.from(rows);
  //cut the first row (th)
  var slicedArray = theArray.slice(1);
  //Run the sort() method on the array, using a compare function that looks at the date.//
  slicedArray.sort(function(a, b){
  let x = makeDate(a);

  let y = makeDate(b);

  if (x < y) {return -1;}
  if (x > y) {return 1;}
  return 0;

});
  //Add the rows back to the table in the new order.//

  var table = document.querySelector("#t1>table");
  table.innerHTML = "";
//restore the original array
  slicedArray.splice(0,0,theArray[0]);
  slicedArray.forEach(function(row) {table.appendChild(row)})

}


// the <date> element and returns a Date. That function can try various ways to get the date (@when, @notBefore, @notAfter, parsing the content of <date>, other things like midpoint of @notBefore/@notAfter, e.g.). Then you can call that function in your sort comparator.
//
//
function makeDate(row) {

  let x = row.querySelector("td:first-of-type tei-date");
    // // rows without date should not be considered
    // if (!x) {return -1};
    //if there is notAfter its value should be considered as date and if not take "when"
    if (x.hasAttribute("notAfter")) {
        x = new Date(x.getAttribute("notAfter"));
    } else {
      x = new Date(x.getAttribute("when"));
    }
    return x;
  }
