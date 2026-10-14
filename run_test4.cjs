const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message, error.stack));
    
    await page.goto('http://localhost:3000');
    
    // Wait for the button and click it
    await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.some(b => b.textContent.includes('Batalhar'));
    });
    
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Batalhar'));
        if (btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Play for 5 seconds
    for(let i = 0; i < 50; i++) {
        await page.mouse.click(500, 500);
        await page.keyboard.press('Space');
        await new Promise(r => setTimeout(r, 100));
    }
    
    await browser.close();
})();
