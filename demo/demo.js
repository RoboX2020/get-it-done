const QUESTIONS = [
  {
    title: "A rectangle is 12 cm by 5 cm. How long is the diagonal?",
    choices: ["13 cm", "17 cm", "7 cm", "60 cm"],
  },
  {
    title: "Solve 3x − 7 = 14.",
    choices: ["x = 7", "x = 5", "x = 3", "x = 21"],
  },
  {
    title: "Which particle carries a negative charge?",
    choices: ["Electron", "Proton", "Neutron", "Nucleus"],
  },
  {
    title: "What is the derivative of x²?",
    choices: ["2x", "x", "2", "x³"],
  },
  {
    title: "A jacket is $18 after 10% off. What was the original price?",
    choices: ["$20", "$16.20", "$19.80", "$28"],
  },
  {
    title: "Simplify (2³)².",
    choices: ["64", "32", "12", "256"],
  },
  {
    title: "Two angles in a triangle are 40° and 65°. What is the third?",
    choices: ["75°", "105°", "55°", "85°"],
  },
  {
    title: "Which gas do plants take in for photosynthesis?",
    choices: ["Carbon dioxide", "Oxygen", "Nitrogen", "Hydrogen"],
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
  prev.textContent = platform.prev;
  prev.disabled = index === 0 || submitted;
  if (index === QUESTIONS.length - 1) {
    next.textContent = submitted ? "Submitted" : "Submit quiz";
    next.disabled = submitted;
  } else {
    next.textContent = platform.next;
    next.disabled = false;
  }
  saved.hidden = true;
  choices.replaceChildren();
  question.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.textContent = choice;
    button.addEventListener("click", () => {
      choices.querySelectorAll(".choice").forEach((item) => item.classList.remove("is-picked"));
      button.classList.add("is-picked");
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
  saved.hidden = false;
});

render();
