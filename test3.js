const regex = /if \(e\.key === 'c' || e\.key === 'C'\) this\.keys\.secondaryHeld = false;/g;
let original = "A if (e.key === 'c' || e.key === 'C') this.keys.secondaryHeld = false; B";
const BLAH = "BLAH";
let mangled = original.replace(regex, BLAH);
console.log("Mangled:", mangled);

let recovered = mangled.split(BLAH).join('');
console.log("Recovered:", recovered);
console.log("Match original?", recovered === original);
