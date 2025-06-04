require('dotenv').config();
const express = require('express');
const axios = require('axios');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 4000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const JUICER_FEED_ID = process.env.JUICER_FEED_ID;

// ---------- YOUTUBE ----------
async function fetchFromYouTube(hashtag = '#chivitahollandiabrunch2025') {
  try {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        q: hashtag,
        key: YOUTUBE_API_KEY,
        maxResults: 6,
        type: 'video',
        part: 'snippet',
      }
    });

    return res.data.items.map(video => ({
      type: 'youtube',
      id: video.id.videoId,
      title: video.snippet.title,
      description: video.snippet.description,
      thumbnail: video.snippet.thumbnails.high.url,
      publishedAt: video.snippet.publishedAt,
      url: `https://www.youtube.com/watch?v=${video.id.videoId}`
    }));
  } catch (err) {
    console.error('YouTube API error:', err.message);
    return [];
  }
}

// ---------- JUICER (Instagram + TikTok) ----------
async function fetchFromJuicer() {
  try {
    const res = await axios.get(`https://www.juicer.io/api/feeds/${JUICER_FEED_ID}`);

    console.log("Juicer raw response:", res.data);

    const items = res.data?.posts?.items;

    if (!Array.isArray(items)) {
      console.error("Juicer error: posts.items is not an array");
      return [];
    }

    return items.map(post => {
      const isVideo = !!post.video;

      return {
        type: post.source === "tiktok" ? "tiktok" : "instagram",
        id: post.external_id || post.id,
        media_url: post.video || post.image,
        thumbnail: post.image,
        media_type: isVideo ? "video" : "image",
        content: post.text || post.title || "",
        permalink: post.full_url,
        timestamp: post.timestamp
      };
    });
  } catch (err) {
    console.error('Juicer feed error:', err.message);
    return [];
  }
}


// ---------- REALTIME SOCKET ----------
io.on('connection', (socket) => {
  console.log('Client connected');
});

// ---------- POLLING LOOP ----------
async function pollFeeds() {
  const [youtube, juicer] = await Promise.all([
    fetchFromYouTube('#chivitahollandiabrunch2025'),
    fetchFromJuicer()
  ]);

  const combined = [...youtube, ...juicer];
  io.emit('newPosts', combined);
}

setInterval(pollFeeds, 10000); // Poll every 10 seconds

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
