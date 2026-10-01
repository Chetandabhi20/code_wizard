import re

with open('c:/Users/cheta/Desktop/civicflow/frontend/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Fix complaintForm issue
js = js.replace("const complaintForm = document.getElementById('complaintForm');", "const complaintForm = document.getElementById('complaintForm'); // optional now")
js = js.replace("complaintForm.addEventListener('submit', async function (e) {", "submitBtn.addEventListener('click', async function (e) {")
js = js.replace("complaintForm.reset();", "if(complaintForm) complaintForm.reset(); else { promptInput.value=''; }")

# Add handleReportSubmission stub just in case
js = "window.handleReportSubmission = function() { document.getElementById('submitBtn').click(); };\n" + js

with open('c:/Users/cheta/Desktop/civicflow/frontend/app.js', 'w', encoding='utf-8') as f:
    f.write(js)
