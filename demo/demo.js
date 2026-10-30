// ============================================================================
// demo.js - a tiny fake quiz that pretends to be a homework site, so the
// real Get Done panel (../extension/content/get-done.js) can be tried in a
// plain browser tab. It renders one multiple-choice question at a time,
// says "Correct!" when you pick right, and moves on with Next - exactly
// the signals the extension watches for.
// ============================================================================
const QUESTIONS = [
  {
    title: "A rectangle is 12 cm by 5 cm. How long is the diagonal?",
    choices: ["17 cm", "13 cm", "7 cm", "60 cm"],
    answer: 1,
  },
  {
    title: "Solve 3x − 7 = 14.",
    choices: ["x = 5", "x = 3", "x = 7", "x = 21"],
    answer: 2,
  },
  {
    title: "Which particle carries a negative charge?",
    choices: ["Proton", "Neutron", "Electron", "Nucleus"],
    answer: 2,
  },
  {
    title: "What is the derivative of x²?",
    choices: ["x", "2", "2x", "x³"],
    answer: 2,
  },
  {
    title: "A jacket is $18 after 10% off. What was the original price?",
    choices: ["$16.20", "$20", "$19.80", "$28"],
    answer: 1,
  },
  {
    title: "Simplify (2³)².",
    choices: ["32", "12", "256", "64"],
    answer: 3,
  },
  {
    title: "Two angles in a triangle are 40° and 65°. What is the third?",
    choices: ["105°", "55°", "85°", "75°"],
    answer: 3,
  },
  {
    title: "Which gas do plants take in for photosynthesis?",
    choices: ["Oxygen", "Nitrogen", "Hydrogen", "Carbon dioxide"],
    answer: 3,
  },
];

const PLATFORMS = {
  canvas: {
    id: "canvas",
    name: "Canvas",
    course: "Algebra II · Period 3",
    quiz: "Quiz 4 — Radicals and equations",
    label: (index, total) => `Question ${index} of ${total}`,
    next: "Next",
    prev: "Previous",
  },
  pearson: {
    id: "pearson",
    name: "Pearson",
    course: "MyLab Math",
    quiz: "Homework 12",
    label: (index, total) => `Item ${index} of ${total}`,
    next: "Next Question",
    prev: "Previous",
  },
  edfinity: {
    id: "edfinity",
    name: "Edfinity",
    course: "Calculus I",
    quiz: "Problem set 6",
    label: (index, total) => `Problem ${index}/${total}`,
    next: "Next",
    prev: "Back",
  },
  brightspace: {
    id: "brightspace",
    name: "Brightspace",
    course: "Chemistry 101",
    quiz: "Chapter 3 check",
    label: (index, total) => `Question ${index} of ${total}`,
    next: "Continue",
    prev: "Back",
  },
};

const label = document.querySelector("#q-label");
const title = document.querySelector("#q-title");
const choices = document.querySelector("#choices");
const prev = document.querySelector("#prev");
const next = document.querySelector("#next");
const check = document.querySelector("#check");
const saved = document.querySelector("#saved");
const course = document.querySelector("#course");
const quiz = document.querySelector("#quiz");
const brand = document.querySelector("#brand");
const switcher = document.querySelector("#switcher");

let platformId = "canvas";
let index = 0;
let submitted = false;
const cleared = new Set();
const picked = {};

function currentPlatform() {
  return PLATFORMS[platformId];
}

function render() {
  const platform = currentPlatform();
  const question = QUESTIONS[index];
  document.documentElement.dataset.getDonePlatform = platform.id;
  document.body.dataset.platform = platform.id;
  brand.textContent = platform.name;
  course.textContent = platform.course;
  quiz.textContent = platform.quiz;
  label.textContent = platform.label(index + 1, QUESTIONS.length);
  title.textContent = question.title;
  document.title = `${platform.quiz} · ${platform.name}`;
  const done = cleared.has(index);
  prev.textContent = platform.prev;
  prev.disabled = index === 0 || submitted;
  if (index === QUESTIONS.length - 1) {
    next.textContent = submitted ? "Submitted" : "Submit quiz";
  } else {
    next.textContent = platform.next;
  }
  next.disabled = submitted || !done;
  if (done) {
    saved.hidden = false;
    saved.dataset.complete = "true";
    saved.className = "saved is-correct";
    saved.textContent = "Correct";
  } else {
    saved.hidden = true;
    delete saved.dataset.complete;
    saved.className = "saved";
    saved.textContent = "";
  }
  choices.replaceChildren();
  question.choices.forEach((choice, choiceIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    if (picked[index] === choiceIndex) button.classList.add("is-picked");
    button.setAttribute("aria-checked", String(picked[index] === choiceIndex));
    button.textContent = choice;
    button.addEventListener("click", () => {
      if (cleared.has(index)) return;
      picked[index] = choiceIndex;
      choices.querySelectorAll(".choice").forEach((item, itemIndex) => {
        item.classList.toggle("is-picked", itemIndex === choiceIndex);
        item.setAttribute("aria-checked", String(itemIndex === choiceIndex));
      });
    });
    choices.appendChild(button);
  });
  switcher.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.platform === platformId));
  });
}

Object.keys(PLATFORMS).forEach((id) => {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.platform = id;
  button.textContent = PLATFORMS[id].name;
  button.addEventListener("click", () => {
    platformId = id;
    render();
  });
  switcher.appendChild(button);
});

prev.addEventListener("click", () => {
  if (index === 0 || submitted) return;
  index -= 1;
  render();
});

next.addEventListener("click", () => {
  if (index >= QUESTIONS.length - 1) {
    submitted = true;
    render();
    return;
  }
  index += 1;
  render();
});

check.addEventListener("click", () => {
  if (cleared.has(index) || submitted) return;
  if (picked[index] == null) {
    saved.hidden = false;
    saved.dataset.complete = "false";
    saved.className = "saved";
    saved.textContent = "Choose an answer first.";
    return;
  }
  if (picked[index] === QUESTIONS[index].answer) {
    cleared.add(index);
    render();
    return;
  }
  saved.hidden = false;
  saved.dataset.complete = "false";
  saved.className = "saved";
  saved.textContent = "Not yet — try another answer.";
});

render();
