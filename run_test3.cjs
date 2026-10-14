const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message, error.stack));
    
    await page.goto('http://localhost:3000');
    
    await new Promise(r => setTimeout(r, 5000));
    
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    console.log("BODY:", bodyHTML);
    
    await browser.close();
})();
