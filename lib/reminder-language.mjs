// Temporal vocabulary for the missing-detail guard. The original request still
// goes to the multilingual planner; this is not a replacement title or action.
export function reminderLanguageText(text){
 return String(text).replace(/\bkal\b|कल/gi,'tomorrow').replace(/\baaj\b|आज/gi,'today')
  .replace(/\bsubah\s+(\d{1,2})(?:\s*baje)?|सुबह\s*(\d{1,2})\s*(?:बजे)?/gi,(_s,a,b)=>'at '+(a||b)+' AM')
  .replace(/\bshaam\s+(\d{1,2})(?:\s*baje)?|शाम\s*(\d{1,2})\s*(?:बजे)?/gi,(_s,a,b)=>'at '+(a||b)+' PM');
}
export const multilingualReminder=text=>/\b(?:kal|aaj|subah|shaam|baje)\b|कल|आज|सुबह|शाम|बजे/i.test(text);
