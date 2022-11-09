import puppeteer from "puppeteer";
import handlebars from "handlebars";

export async function generateImage({
  width = 1200,
  height = 630,
  content = "",
}) {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
      defaultViewport: {
        width,
        height,
      },
    });
    const page = await browser.newPage();

    // Set the content to our rendered HTML
    await page.setContent(content, { waitUntil: "domcontentloaded" });
    // Wait until all images and fonts have loaded
    await page.evaluate(async () => {
      const selectors = Array.from(document.querySelectorAll("img"));
      await Promise.all([
        document.fonts.ready,
        ...selectors.map((img) => {
          // Image has already finished loading, let’s see if it worked
          if (img.complete) {
            // Image loaded and has presence
            if (img.naturalHeight !== 0) return;
            // Image failed, so it has no height
            throw new Error("Image failed to load");
          }
          // Image hasn’t loaded yet, added an event listener to know when it does
          return new Promise((resolve, reject) => {
            img.addEventListener("load", resolve);
            img.addEventListener("error", reject);
          });
        }),
      ]);
    });

    const element = await page.$("#body");
    const image = await element?.screenshot({ omitBackground: true });
    await browser.close();

    return image;
  } catch (e) {
    console.log(e);
    return null;
  }
}

export function getCompiledHTML({
  logoUrl = "",
  title = "",
  tags = "",
  path = "",
  bgUrl = "",
}) {
  return handlebars.compile(templateHTML)({
    logoUrl,
    title,
    tags,
    path,
    bgUrl,
    styles: compileStyles({ bgUrl, title }),
  });
}

function compileStyles({ bgUrl = "", title = "" }) {
  return handlebars.compile(templateStyles)({
    bgUrl,
    fontSize: getFontSize(title),
  });
}

function getFontSize(title = "") {
  if (!title || typeof title !== "string") return "";

  const titleLength = title.length;

  if (titleLength > 55) return "2.75rem";
  if (titleLength > 35) return "3.25rem";
  if (titleLength > 25) return "4.25rem";

  return "4.75rem";
}

const templateHTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <style>{{styles}}</style>
  </head>
  <body id="body">
    <main>
      <div class="title">{{title}}</div>
      <div class='logo'> 
      {{#if logoUrl}}
        <img src="{{logoUrl}}" alt="logo" />
      {{else}}
        <span>Bitwarden</span>
      {{/if}}
      {{#if bgUrl}}
        <img src="{{bgUrl}}" alt="logo" style="display:none"/>
      {{/if}}
      </div>
    </main>
  </body>
</html>
`;

const templateStyles = `
  @font-face {
    font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol";
    src: url(https://fonts.googleapis.com/css?family=Open+Sans:300,400,600,700,300italic,400italic,600italic);
  }
  * {
    box-sizing: border-box;
  }
  :root {
    font-size: 16px;
    font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol";
  }
  body {
    padding: 2.5rem;
    height: 90vh;
    background: #042f7d;
    {{#if bgUrl}}
    background-image: url({{bgUrl}});
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    {{else}}
    background: linear-gradient(to right, #042f7d, #007eff);
    color: #00ffae;
    {{/if}}
  }
  main {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .logo {
    width: 8rem;
    height: 8rem;
  }
  .logo span {
    font-size: 5rem;
    color: yellow;
    font-style: italic;
    text-decoration: wavy;
    font-variant: unicase;
  }
  .logo img {
    width: 100%;
    height: 100%;
  }
  .title {
    font-size: {{fontSize}};
    text-transform: capitalize;
    margin: 0.5rem 0;
    font-weight: bold;
    color: white
  }
`;
