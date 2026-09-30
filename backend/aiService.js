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

    module.exports = { analyzeComplaint };