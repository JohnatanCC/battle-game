const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message, error.stack));
    
    await page.goto('http://localhost:3000');
    
    // Simulate playing the game
    await page.waitForSelector('canvas');
    
    // Start game
    await page.mouse.click(500, 500); // Click anywhere?
    
    // Press space, click
    for(let i = 0; i < 50; i++) {
        await page.keyboard.press('Space');
        await page.mouse.click(500, 500);
        await new Promise(r => setTimeout(r, 100));
    }
    
    await browser.close();
})();
