let code = "let audio = this.audioPools[name].find(a => a.paused || a.ended);";
code = code.replace(/if \(e\.key === 'c' || e\.key === 'C'\) this\.keys\.secondaryHeld = false;/g, "BLAH");
console.log(code);
