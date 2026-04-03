const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testUpload() {
    try {
        fs.writeFileSync('test.txt', 'hello');
        const form = new FormData();
        form.append('file', fs.createReadStream('test.txt'));
        const response = await axios.post('http://localhost:5000/api/uploads/submission', form, {
            headers: form.getHeaders(),
        });
        console.log("SUCCESS:", response.data);
    } catch (e) {
        console.error("FAILED:", e.response?.data || e.message);
    }
}
testUpload();
