import{test,expect}from"@playwright/test";
const pages=["decision","position","context","journal","market","experiments","lab","nlp","diagnostics","datasets","verdicts","surveillance","governance"];
test.describe.configure({mode:"serial"});
for(const page of pages){test(`render ${page}`,async({page:browserPage})=>{await browserPage.goto(`http://127.0.0.1:4173/#${page}`,{waitUntil:"networkidle"});await expect(browserPage.locator("#app")).not.toBeEmpty();await expect(browserPage.locator("#app .badge")).toHaveCount(1);await browserPage.screenshot({path:`artifacts/khalyon-${page}.png`,fullPage:true});});}
