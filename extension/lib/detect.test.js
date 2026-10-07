const assert = require("node:assert/strict");
const {
  findQuestion,
  parseLinks,
  platformFromHost,
  platformFromSignals,
  completionFromClass,
  completionFromText,
} = require("./detect");

assert.deepEqual(findQuestion("Question 3 of 10"), {
  key: "3",
  label: "3",
  index: 3,
  current: 3,
  total: 10,
  confident: true,
  kind: "numeric",
});
assert.deepEqual(findQuestion("Question 45 of 45"), {
  key: "45",
  label: "45",
  index: 45,
  current: 45,
  total: 45,
  confident: true,
  kind: "numeric",
});
assert.deepEqual(findQuestion("Problem 12/45"), {
  key: "12",
  label: "12",
  index: 12,
  current: 12,
  total: 45,
  confident: true,
  kind: "numeric",
});
assert.deepEqual(findQuestion("Item 2 of 8"), {
  key: "2",
  label: "2",
  index: 2,
  current: 2,
  total: 8,
  confident: true,
  kind: "numeric",
});
assert.deepEqual(findQuestion("Exercise 7 / 15"), {
  key: "7",
  label: "7",
  index: 7,
  current: 7,
  total: 15,
  confident: true,
  kind: "numeric",
});
assert.deepEqual(findQuestion("Part 2 of 4"), {
  key: "2",
  label: "2",
  index: 2,
  current: 2,
  total: 4,
  confident: true,
  kind: "numeric",
});
assert.deepEqual(findQuestion("Q 4 of 12"), {
  key: "4",
  label: "4",
  index: 4,
  current: 4,
  total: 12,
  confident: true,
  kind: "numeric",
});
assert.deepEqual(findQuestion("4 of 9 questions"), {
  key: "4",
  label: "4",
  index: 4,
  current: 4,
  total: 9,
  confident: true,
  kind: "numeric",
});
assert.deepEqual(findQuestion("Question 4"), {
  key: "4",
  label: "4",
  index: 4,
  current: 4,
  total: null,
  confident: false,
  kind: "numeric",
});
assert.deepEqual(findQuestion("3/10"), {
  key: "3",
  label: "3",
  index: 3,
  current: 3,
  total: 10,
  confident: false,
  kind: "numeric",
});
assert.deepEqual(findQuestion("2 of 15"), {
  key: "2",
  label: "2",
  index: 2,
  current: 2,
  total: 15,
  confident: false,
  kind: "numeric",
});
assert.deepEqual(findQuestion("Problem 1.18.3"), {
  key: "1.18.3",
  label: "1.18.3",
  index: null,
  current: null,
  total: null,
  confident: true,
  kind: "slug",
});
assert.deepEqual(findQuestion("1.17.2"), {
  key: "1.17.2",
  label: "1.17.2",
  index: null,
  current: null,
  total: null,
  confident: true,
  kind: "slug",
});
assert.deepEqual(findQuestion("5.3"), {
  key: "5.3",
  label: "5.3",
  index: null,
  current: null,
  total: null,
  confident: true,
  kind: "slug",
});
assert.equal(findQuestion("Homework 1.18.3 extra copy").kind, "slug");
assert.equal(findQuestion("Homework 1.18.3 extra copy").key, "1.18.3");
assert.equal(findQuestion("Problem 1.18.3").key, "1.18.3");
assert.notEqual(findQuestion("Problem 1.18.3").key, "1");
assert.equal(platformFromHost("tdx.acs.pearson.com").id, "pearson");
assert.equal(platformFromHost("mylabschool.pearson.com").id, "pearson");
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
assert.equal(completionFromText("Good job!"), "accepted");
assert.equal(completionFromText("Partially correct"), "rejected");
assert.equal(completionFromText("Which particle carries a negative charge?"), null);
assert.equal(completionFromClass("is-correct result"), "accepted");
assert.equal(completionFromClass("incorrect"), "rejected");
assert.equal(completionFromClass("question-header"), null);

console.log("detect tests passed");
