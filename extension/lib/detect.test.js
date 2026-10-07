const assert = require("node:assert/strict");
const {
  findQuestion,
  parseLinks,
  platformFromHost,
  platformFromSignals,
  completionFromClass,
  completionFromText,
} = require("./detect");

assert.deepEqual(findQuestion("Question 3 of 10"), { current: 3, total: 10, confident: true });
assert.deepEqual(findQuestion("Question 45 of 45"), { current: 45, total: 45, confident: true });
assert.deepEqual(findQuestion("Problem 12/45"), { current: 12, total: 45, confident: true });
assert.deepEqual(findQuestion("Item 2 of 8"), { current: 2, total: 8, confident: true });
assert.deepEqual(findQuestion("Exercise 7 / 15"), { current: 7, total: 15, confident: true });
assert.deepEqual(findQuestion("Part 2 of 4"), { current: 2, total: 4, confident: true });
assert.deepEqual(findQuestion("Q 4 of 12"), { current: 4, total: 12, confident: true });
assert.deepEqual(findQuestion("4 of 9 questions"), { current: 4, total: 9, confident: true });
assert.deepEqual(findQuestion("Question 4"), { current: 4, total: null, confident: false });
assert.deepEqual(findQuestion("3/10"), { current: 3, total: 10, confident: false });
assert.equal(findQuestion("Question 0 of 5"), null);
assert.equal(findQuestion("Question 6 of 5"), null);
assert.equal(findQuestion(""), null);
assert.equal(
  findQuestion("The question of the day is long enough that this paragraph should never count as a counter."),
  null,
);

assert.equal(platformFromHost("school.instructure.com").id, "canvas");
assert.equal(platformFromHost("canvas.university.edu").id, "canvas");
assert.equal(platformFromHost("www.edfinity.com").id, "edfinity");
assert.equal(platformFromHost("mlm.pearson.com").id, "pearson");
assert.equal(platformFromHost("www.mathxl.com").id, "pearson");
assert.equal(platformFromHost("classroom.google.com").id, "classroom");
assert.equal(platformFromHost("www.gradescope.com").id, "gradescope");
assert.equal(platformFromHost("www.deltamath.com").id, "deltamath");
assert.equal(platformFromHost("google.com"), null);
assert.equal(platformFromHost("notcanvas.university.edu"), null);
assert.equal(platformFromSignals("body class ic-app header").id, "canvas");
assert.equal(platformFromSignals('<meta name="generator" content="Moodle">').id, "moodle");

const many = Array.from({ length: 45 }, (_, index) => `https://pics.example/${index + 1}.png`).join("\n");
assert.equal(parseLinks(many).length, 45);
assert.deepEqual(parseLinks("https://a.example/1.png\nhttps://b.example/2.jpg"), [
  "https://a.example/1.png",
  "https://b.example/2.jpg",
]);
assert.deepEqual(parseLinks("- https://a.example/1.png\n2. https://b.example/2.jpg,"), [
  "https://a.example/1.png",
  "https://b.example/2.jpg",
]);
assert.deepEqual(parseLinks("javascript:alert(1)\nhttps://ok.example/a.png"), ["https://ok.example/a.png"]);
assert.deepEqual(parseLinks("see https://ok.example/a.png)."), ["https://ok.example/a.png"]);
assert.deepEqual(parseLinks("cdn.example.com/cat.webp"), ["https://cdn.example.com/cat.webp"]);
assert.deepEqual(parseLinks("data:text/html,hi"), []);
assert.equal(completionFromText("Correct"), "accepted");
assert.equal(completionFromText("Correct. The diagonal is 13 cm."), "accepted");
assert.equal(completionFromText("Answer submitted"), "accepted");
assert.equal(completionFromText("Not yet — try another answer."), "rejected");
assert.equal(completionFromText("Incorrect"), "rejected");
assert.equal(completionFromText("Try again"), "rejected");
assert.equal(completionFromText("Which particle carries a negative charge?"), null);
assert.equal(completionFromClass("is-correct result"), "accepted");
assert.equal(completionFromClass("incorrect"), "rejected");
assert.equal(completionFromClass("question-header"), null);

console.log("detect tests passed");
