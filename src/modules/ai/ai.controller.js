const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

exports.transcribeAudio = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const apiKey = process.env.OPENAI_API_KEY;

        // If no API key is provided, returning simulated AI captions for testing purposes.
        if (!apiKey || apiKey === 'YOUR_OPENAI_KEY_HERE') {
            console.log("No OPENAI_API_KEY detected. Returning simulated Whisper AI transcription for demonstration.");
            
            // Clean up the temp file
            fs.unlinkSync(filePath);

            const simulatedCaptions = [
                { start: 0, end: 2.5, text: "Chào mừng các bạn đến với video" },
                { start: 2.5, end: 5.0, text: "Hôm nay chúng ta sẽ cùng tìm hiểu" },
                { start: 5.0, end: 7.5, text: "Về tính năng tạo phụ đề AI tự động" },
                { start: 7.5, end: 10.0, text: "Cực kỳ chuyên nghiệp và mượt mà!" }
            ];

            return res.status(200).json({
                success: true,
                simulated: true,
                captions: simulatedCaptions
            });
        }

        // --- Actual OpenAI Whisper API Call ---
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'verbose_json'); // Gets timestamps instead of flat text
        formData.append('timestamp_granularities[]', 'segment'); // Segment-level timestamps

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${apiKey}`,
            },
            maxBodyLength: Infinity
        });

        // Clean up temp file
        fs.unlinkSync(filePath);

        // Convert the OpenAI segments format to FAF Captions format
        const captions = response.data.segments.map(seg => ({
            start: seg.start,
            end: seg.end,
            text: seg.text.trim()
        }));

        res.status(200).json({
            success: true,
            captions: captions
        });
    } catch (error) {
        console.error("AI Transcribe Error:", error?.response?.data || error.message);
        
        // Ensure file is deleted if error occurs
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ success: false, message: 'Failed to transcribe audio' });
    }
};
