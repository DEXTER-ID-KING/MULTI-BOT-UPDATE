const axios = require('axios');

async function withRetry(operation, maxRetries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (err.message.includes('socket hang up') && attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed with socket hang up. Retrying after ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
}

module.exports = [
  {
    id: "update_001",
    version: "1.0.0",
    message: "Add test command, custom event, and play command for song download",
    data: {
      commands: {
        '.test': async ({ conn, mek, args, sessionId }) => {
          await conn.sendMessage(mek.key.remoteJid, {
            text: `Test command executed! Args: ${args.join(' ')}`
          }, { quoted: mek });
          console.log(`Test command run in session ${sessionId}`);
        },
        '.play': async ({ conn, mek, args, sessionId }) => {
          if (!args[0] || !args[0].startsWith('https://youtu')) {
            await conn.sendMessage(mek.key.remoteJid, {
              text: '❌ Please provide a valid YouTube URL (e.g., .play https://youtu.be/qF-JLqKtr2Q)'
            }, { quoted: mek });
            return;
          }

          const youtubeUrl = args[0];
          const apiUrl = `https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(youtubeUrl)}`;

          try {
            const response = await withRetry(() => axios.get(apiUrl));
            if (!response.data.success || response.data.status !== 200) {
              await conn.sendMessage(mek.key.remoteJid, {
                text: '❌ Failed to fetch song details from API'
              }, { quoted: mek });
              return;
            }

            const { title, thumbnail, download_url } = response.data.result;

            // Send thumbnail with title as caption
            const thumbnailResponse = await withRetry(() => axios.get(thumbnail, { responseType: 'arraybuffer' }));
            const thumbnailBuffer = Buffer.from(thumbnailResponse.data);
            await withRetry(() => conn.sendMessage(mek.key.remoteJid, {
              image: thumbnailBuffer,
              caption: title
            }, { quoted: mek }));

            // Send audio file
            const audioResponse = await withRetry(() => axios.get(download_url, { responseType: 'arraybuffer' }));
            const audioBuffer = Buffer.from(audioResponse.data);
            await withRetry(() => conn.sendMessage(mek.key.remoteJid, {
              audio: audioBuffer,
              mimetype: 'audio/mpeg',
              fileName: `${title}.mp3`
            }, { quoted: mek }));

            console.log(`Song "${title}" sent successfully for session ${sessionId}`);
          } catch (err) {
            console.error(`Error in .play command for session ${sessionId}:`, err.message);
            await conn.sendMessage(mek.key.remoteJid, {
              text: `❌ Error downloading song: ${err.message}`
            }, { quoted: mek });
          }
        }
      },
      events: {
        'messages.upsert': async ({ messages }, { conn, sessionId }) => {
          const message = messages[0];
          if (message.message?.conversation === 'hello') {
            await conn.sendMessage(message.key.remoteJid, {
              text: 'Hello back from custom event!'
            });
            console.log(`Custom event triggered in session ${sessionId}`);
          }
        }
      }
    }
  },
  {
    id: "update_002",
    version: "1.0.1",
    message: "Add greet command",
    data: {
      commands: {
        '.greet': async ({ conn, mek, args, sessionId }) => {
          const name = args[0] || 'User';
          await conn.sendMessage(mek.key.remoteJid, {
            text: `Hello, ${name}! Welcome from update 1.0.1`
          }, { quoted: mek });
          console.log(`Greet command run in session ${sessionId}`);
        }
      }
    }
  }
];
