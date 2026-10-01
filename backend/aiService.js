/**
     * AI Natural Language Processing Engine for CivicFlow
     * Powered by Google Gemini AI LLM with Heuristic Fallback
     */

    async function analyzeComplaint(rawText) {
      const text = (rawText || '').trim();
      const apiKey = process.env.GEMINI_API_KEY;

      // 1. Try Real Google Gemini AI LLM Analysis
      if (apiKey && apiKey !== 'your_actual_gemini_api_key_here') {
        try {
          console.log('🤖 Sending prompt to Google Gemini AI model...');

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `You are an expert municipal civic triage AI. A citizen reported the following issue in their neighborhood:
    "${text}"

    Analyze the statement deeply. Understand the real-world problem, danger level, and responsible department.
    Respond ONLY with a valid JSON object (no markdown, no backticks, no extra words) matching this exact schema:
    {
      "title": "A concise, professional 4-8 word title summarizing the specific issue",
      "category": "Roads" | "Electricity" | "Sanitation" | "Water" | "Other",
      "suggestedDepartment": "Roads" | "Electricity" | "Sanitation" | "Water" | "General Maintenance",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "aiSummary": "A concise 1-2 sentence engineering assessment explaining why this priority was assigned and what field action is
  recommended."
    }`
                  }]
                }]
              })
            }
          );

          const data = await response.json();

          if (data.candidates && data.candidates[0].content.parts[0].text) {
            const rawOutput = data.candidates[0].content.parts[0].text;
            // Clean any accidental markdown codeblock backticks
            const cleanJson = rawOutput.replace(/```json|```/g, '').trim();
            const aiParsed = JSON.parse(cleanJson);
            console.log('✅ Google Gemini AI analysis complete:', aiParsed);
            return aiParsed;
          }
        } catch (err) {
          console.warn('⚠️ Gemini API call failed, using smart fallback heuristics:', err.message);
        }
      }

      // 2. Intelligent Contextual Fallback (if no API key is provided)
      console.log('⚡ Running offline semantic heuristics...');
      return fallbackHeuristicAnalysis(text);
    }

    function fallbackHeuristicAnalysis(text) {
      const lower = text.toLowerCase();

      let category = 'Other';
      let department = 'General Maintenance';

      if (/wire|electric|pole|light|spark|power|shock|transformer|blackout|dark street/i.test(lower)) {
        category = 'Electricity';
        department = 'Electricity';
      } else if (/pothole|road|asphalt|tar|divider|pavement|crater|traffic signal|speed breaker|collapsed street/i.test(lower)) {
        category = 'Roads';
        department = 'Roads';
      } else if (/garbage|trash|waste|dustbin|overflow|drain|sewage|manhole|smell|stink|dump/i.test(lower)) {
        category = 'Sanitation';
        department = 'Sanitation';
      } else if (/pipe|water|leak|supply|tap|flooding|puddle|valve|contamination|burst/i.test(lower)) {
        category = 'Water';
        department = 'Water';
      }

      const isHigh = /danger|emergency|spark|shock|live wire|burst|flooding|crash|accident|collapse|hazard|fire/i.test(lower);
      const isLow = /graffiti|poster|minor|scratch|faded|peeling|dirty/i.test(lower);
      const priority = isHigh ? 'HIGH' : isLow ? 'LOW' : 'MEDIUM';

      const firstSentence = text.split(/[.!?\n]/)[0].trim();
      const title = firstSentence.length > 5 && firstSentence.length <= 60
        ? firstSentence
        : `${priority === 'HIGH' ? 'Critical' : 'Reported'} ${category} Issue`;

      const summary = priority === 'HIGH'
        ? `🚨 Critical hazard identified in ${category} domain. Immediate field dispatch recommended.`
        : `⚠️ Standard ${category} issue identified. Routed to ${department} team.`;

  return {
    title: title,
    category: category,
    suggestedDepartment: department,
    priority: priority,
    aiSummary: summary
  };
}

/**
 * Task 1: Verify if an uploaded image depicts a genuine civic issue.
 * @param {string} base64Image - Base64 string of the image.
 * @param {string} mimeType - The mime type of the image.
 * @returns {Promise<{is_valid: boolean, reason: string}>}
 */
async function verifyImage(base64Image, mimeType = 'image/jpeg') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_actual_gemini_api_key_here') {
    return { is_valid: true, reason: 'AI disabled, assuming valid.' };
  }

  try {
    console.log('🤖 Sending image to Google Gemini Multimodal Vision for verification...');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `You are an expert municipal AI. Look at this image. Determine if it shows a genuine civic issue (e.g., pothole, broken pipe, illegal dumping, damaged infrastructure) or if it is a fake, meme, random photo, or inappropriate.
Respond ONLY with a valid JSON object (no markdown) matching this exact schema:
{
  "is_valid": true or false,
  "reason": "Short explanation of why it is valid or fake"
}`
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Image
                }
              }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      const rawOutput = data.candidates[0].content.parts[0].text;
      const cleanJson = rawOutput.replace(/```json|```/g, '').trim();
      const result = JSON.parse(cleanJson);
      console.log('✅ Image verification complete:', result);
      return result;
    }
    return { is_valid: false, reason: 'Could not parse response.' };
  } catch (err) {
    console.warn('⚠️ Gemini Image Verification failed:', err.message);
    return { is_valid: true, reason: 'Error during verification, failing open.' };
  }
}

/**
 * Task 2: Check if a new report is a duplicate of a nearby pending report.
 * @param {string} newReportText - The description of the new report.
 * @param {Array<{id: number|string, description: string}>} nearbyReports - List of nearby pending reports.
 * @returns {Promise<number|string|null>} - The matching report ID if duplicate, or null.
 */
async function checkIncidentFusion(newReportText, nearbyReports) {
  if (!nearbyReports || nearbyReports.length === 0) return null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_actual_gemini_api_key_here') return null;

  try {
    console.log('🤖 Sending incident fusion prompt to Google Gemini AI model...');
    const nearbyList = nearbyReports.map(r => `ID: ${r.id} - Description: ${r.description}`).join('\n');
    const prompt = `You are an expert municipal AI deduplication agent.
A new civic issue was reported:
"${newReportText}"

Here are existing pending reports within 100 meters:
${nearbyList}

Are any of these describing the exact same physical incident as the new report?
Respond ONLY with a valid JSON object (no markdown) matching this exact schema:
{
  "is_duplicate": true or false,
  "matching_report_id": "the ID of the matching report if is_duplicate is true, else null",
  "reason": "Short explanation"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      const rawOutput = data.candidates[0].content.parts[0].text;
      const cleanJson = rawOutput.replace(/```json|```/g, '').trim();
      const result = JSON.parse(cleanJson);
      console.log('✅ Incident fusion analysis complete:', result);
      
      if (result.is_duplicate && result.matching_report_id) {
        return result.matching_report_id;
      }
    }
    return null;
  } catch (err) {
    console.warn('⚠️ Gemini Incident Fusion failed:', err.message);
    return null;
  }
}

module.exports = { analyzeComplaint, verifyImage, checkIncidentFusion };