const request=/\b(add|create|save|set|remember|remind|record|log|note|track|put|make)\b|याद|जोड|लक्षात|रिमाइंड/i;
export function mutationAllowed(text,history=[]){
 if(request.test(text))return true;
 const last=history.at(-1);
 const clarification=last?.role==='assistant'&&/\?|which|when|what time|date|confirm/i.test(last.content);
 const continuation=/^(?:(?:german(?:y)?|berlin|india(?:n)?)\s+time|Europe\/Berlin|Asia\/Kolkata|UTC|CET|CEST|IST|AM\b|PM\b|yes\b|yeah\b|yep\b|sure\b|okay\b|ok\b|today|tomorrow|tonight|at\b|on\b|in\b|after\b|next\b|this\b|₹|rs\.?\s*\d|\d|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b|twenty\b|thirty\b|it was\b|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may\b|june|july|august|september|october|november|december|हाँ|हां|हो)/i.test(text.trim());
 const savedIndex=history.findLastIndex(m=>m.role==='assistant'&&/Saved to /i.test(m.content));
 return Boolean(clarification&&continuation&&history.slice(Math.max(savedIndex+1,history.length-10)).some(m=>m.role==='user'&&request.test(m.content)));
}
