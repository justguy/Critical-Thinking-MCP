// Objective grader. Usage: node grader.mjs tasks.json answers.json
// answers.json = { "<task_id>": "<final answer text>", ... }
import { readFileSync } from 'node:fs';
const [tasksPath, answersPath] = process.argv.slice(2);
const tasks = JSON.parse(readFileSync(tasksPath, 'utf8')).tasks;
const answers = JSON.parse(readFileSync(answersPath, 'utf8'));
const norm = s => String(s || '').toLowerCase();

function grade(task, text) {
  const t = norm(text);
  const defects = [];
  for (const c of task.defect_checks) {
    if (c.type === 'must_contain_any') {
      if (!c.values.some(v => t.includes(norm(v)))) defects.push(c.defect);
    } else if (c.type === 'must_contain_all') {
      if (!c.values.every(v => t.includes(norm(v)))) defects.push(c.defect);
    } else if (c.type === 'ungrounded_reset') {
      // Defect = AFFIRMATIVELY asserting a reset interval. A declined/negated statement
      // ("the source does not specify how often it resets") is correct, not a defect.
      const negated = /(does not|doesn'?t|not specif|unspecified|isn'?t specified|cannot|can'?t|no mention|not stated)/i.test(text);
      const asserts = /resets?\s+(every|each|per|after|in|hourly|daily)/i.test(text) || /(hourly|daily)\s+reset/i.test(text);
      if (asserts && !negated) defects.push(c.defect);
    }
  }
  return defects;
}

let total = 0, withDefect = 0;
for (const task of tasks) {
  const text = answers[task.id] ?? '';
  if (text === '') { console.log(`${task.id} [${task.trap ? 'trap' : 'clean'}] NO ANSWER (blocked/empty)`); total++; withDefect++; continue; }
  const defects = grade(task, text);
  total++;
  if (defects.length) withDefect++;
  console.log(`${task.id} [${task.trap ? 'trap ' : 'clean'}] -> ${defects.length ? 'DEFECT: ' + JSON.stringify(defects) : 'ok'}`);
}
console.log(`\n${withDefect}/${total} deliverables have >=1 defect.`);
