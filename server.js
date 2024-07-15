const express = require('express');
const puppeteer = require('puppeteer');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let browser;

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('search', async (query) => {
    console.log(`Received search query: ${query}`);
    if (!browser) {
      browser = await puppeteer.launch({ headless: true });
    }
    const page = await browser.newPage();
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    try {
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });

      // Extract search results
      const searchResults = await page.evaluate(() => {
        const results = [];
        const items = document.querySelectorAll('div.g');
        items.forEach(item => {
          const title = item.querySelector('h3') ? item.querySelector('h3').innerText : '';
          const link = item.querySelector('a') ? item.querySelector('a').href : '';
          const snippet = item.querySelector('.aCOpRe') ? item.querySelector('.aCOpRe').innerText : '';
          if (title && link) {
            results.push({ title, link, snippet });
          }
        });
        return results;
      });

      socket.emit('searchResults', searchResults);
      await page.close();
    } catch (error) {
      console.error(`Error fetching page for query "${query}": ${error.message}`);
      socket.emit('pageContent', `<h1>Error: ${error.message}</h1>`);
    }
  });

  socket.on('navigate', async (url) => {
    try {
      if (!browser) {
        browser = await puppeteer.launch({ headless: true });
      }
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });

      const content = await page.content();
      socket.emit('pageContent', content);
      await page.close();
    } catch (error) {
      console.error(`Error navigating to URL "${url}": ${error.message}`);
      socket.emit('pageContent', `<h1>Error: ${error.message}</h1>`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = 5674;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
