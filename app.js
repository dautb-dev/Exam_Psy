(() => {
  const questionBank = window.QUESTION_BANK;
  const expectedBankCount = 400;
  const expectedQuestionCount = 40;
  const questionCountPerLecture = 4;
  const startButton = document.querySelector("#start-button");
  const introView = document.querySelector("#intro");
  const examView = document.querySelector("#exam");
  const resultsView = document.querySelector("#results");
  const questionGrid = document.querySelector("#question-grid");
  const questionText = document.querySelector("#question-text");
  const questionNumber = document.querySelector("#question-number");
  const lectureTag = document.querySelector("#lecture-tag");
  const answerList = document.querySelector("#answer-list");
  const answerFeedback = document.querySelector("#answer-feedback");
  const progressLabel = document.querySelector("#progress-label");
  const answeredLabel = document.querySelector("#answered-label");
  const progressBar = document.querySelector("#progress-bar");
  const progressFill = document.querySelector("#progress-fill");
  const previousButton = document.querySelector("#previous-button");
  const nextButton = document.querySelector("#next-button");
  const finishDialog = document.querySelector("#finish-dialog");
  const dialogMessage = document.querySelector("#dialog-message");
  const reviewFilter = document.querySelector("#review-filter");
  const reviewList = document.querySelector("#review-list");

  let attempt = [];
  let answers = new Map();
  let currentIndex = 0;

  function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function validateQuestionBank() {
    if (!Array.isArray(questionBank)) {
      return "Не удалось загрузить вопросы. Проверьте, что questions.js находится рядом с index.html.";
    }
    if (questionBank.length !== expectedBankCount) {
      return `В банке должно быть ${expectedBankCount} вопросов, найдено: ${questionBank.length}.`;
    }
    const seenQuestions = new Set();
    const countsByLecture = Array(10).fill(0);
    for (const question of questionBank) {
      if (
        !Number.isInteger(question.sourceQuestion) ||
        question.sourceQuestion < 1 ||
        question.sourceQuestion > expectedBankCount ||
        seenQuestions.has(question.sourceQuestion) ||
        !Number.isInteger(question.lecture) ||
        question.lecture < 1 ||
        question.lecture > 10 ||
        !question.prompt ||
        !question.answer ||
        !Array.isArray(question.distractors) ||
        question.distractors.length !== 3 ||
        question.distractors.some((distractor) => typeof distractor !== "string" || !distractor.trim()) ||
        !question.explanation ||
        !question.file ||
        !Number.isInteger(question.page) ||
        question.page < 1
      ) {
        return "В банке есть вопрос с пропущенными или некорректными данными.";
      }
      const answerKeys = new Set([question.answer.trim().toLocaleLowerCase("ru")]);
      for (const distractor of question.distractors) {
        const distractorKey = distractor.trim().toLocaleLowerCase("ru");
        if (answerKeys.has(distractorKey)) {
          return `У вопроса №${question.sourceQuestion} повторяются правильный ответ и варианты.`;
        }
        answerKeys.add(distractorKey);
      }
      seenQuestions.add(question.sourceQuestion);
      countsByLecture[question.lecture - 1] += 1;
    }

    for (let lecture = 1; lecture <= 10; lecture += 1) {
      const lectureQuestions = questionBank.filter((question) => question.lecture === lecture);
      const uniqueAnswers = new Set(lectureQuestions.map((question) => question.answer.trim().toLocaleLowerCase("ru")));
      if (countsByLecture[lecture - 1] !== 40 || uniqueAnswers.size < 4) {
        return `Для лекции ${lecture} нужны 40 вопросов и минимум 4 разных ответа.`;
      }
    }
    return "";
  }

  const bankError = validateQuestionBank();
  if (bankError) {
    const warning = document.createElement("p");
    warning.className = "setup-error";
    warning.setAttribute("role", "alert");
    warning.textContent = bankError;
    introView.append(warning);
    startButton.disabled = true;
    console.error(bankError);
    return;
  }

  function getAnsweredCount() {
    return attempt.reduce((count, question) => count + (answers.has(question.sourceQuestion) ? 1 : 0), 0);
  }

  function updateProgress() {
    const answeredCount = getAnsweredCount();
    progressLabel.textContent = `Вопрос ${currentIndex + 1} из ${expectedQuestionCount}`;
    answeredLabel.textContent = `Отвечено: ${answeredCount} из ${expectedQuestionCount}`;
    progressBar.setAttribute("aria-valuenow", String(answeredCount));
    progressFill.style.width = `${(answeredCount / expectedQuestionCount) * 100}%`;

    questionGrid.querySelectorAll(".question-jump").forEach((button, index) => {
      button.classList.toggle("is-current", index === currentIndex);
      button.classList.toggle("is-answered", answers.has(attempt[index].sourceQuestion));
      if (index === currentIndex) {
        button.setAttribute("aria-current", "step");
      } else {
        button.removeAttribute("aria-current");
      }
    });
  }

  function renderQuestionGrid() {
    questionGrid.replaceChildren();
    attempt.forEach((question, index) => {
      const button = document.createElement("button");
      button.className = "question-jump";
      button.type = "button";
      button.textContent = String(index + 1);
      button.setAttribute("aria-label", `Перейти к вопросу ${index + 1}, лекция ${question.lecture}`);
      button.addEventListener("click", () => {
        currentIndex = index;
        renderQuestion();
      });
      questionGrid.append(button);
    });
  }

  function renderAnswerFeedback(question) {
    const hasAnswered = answers.has(question.sourceQuestion);
    const selectedAnswer = answers.get(question.sourceQuestion);
    const isCorrect = hasAnswered && selectedAnswer === question.answer;

    answerList.querySelectorAll(".answer-option").forEach((item) => {
      const option = item.querySelector("input").value;
      const isSelected = selectedAnswer === option;
      item.classList.toggle("is-selected", isSelected);
      item.classList.toggle("is-correct", hasAnswered && option === question.answer);
      item.classList.toggle("is-incorrect", isSelected && option !== question.answer);
    });

    answerFeedback.replaceChildren();
    answerFeedback.classList.toggle("is-hidden", !hasAnswered);
    answerFeedback.classList.toggle("is-correct", isCorrect);
    answerFeedback.classList.toggle("is-incorrect", hasAnswered && !isCorrect);
    if (!hasAnswered) {
      return;
    }

    const status = document.createElement("p");
    status.className = "answer-feedback-status";
    status.textContent = isCorrect ? "Верно!" : "Неверно";

    const correctAnswer = document.createElement("p");
    correctAnswer.className = "answer-feedback-answer";
    correctAnswer.append(document.createTextNode("Правильный ответ: "));
    const correctText = document.createElement("strong");
    correctText.textContent = question.answer;
    correctAnswer.append(correctText);

    const explanation = document.createElement("p");
    explanation.className = "answer-feedback-explanation";
    explanation.append(document.createTextNode("Объяснение: "));
    explanation.append(document.createTextNode(question.explanation));

    answerFeedback.append(status, correctAnswer, explanation);
  }

  function renderQuestion() {
    const question = attempt[currentIndex];
    questionNumber.textContent = `ВОПРОС ${String(currentIndex + 1).padStart(2, "0")}`;
    lectureTag.textContent = `Лекция ${question.lecture}`;
    questionText.textContent = question.prompt;
    answerList.replaceChildren();

    question.options.forEach((option, optionIndex) => {
      const label = document.createElement("label");
      label.className = "answer-option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `answer-${question.sourceQuestion}`;
      input.value = option;
      input.checked = answers.get(question.sourceQuestion) === option;
      input.setAttribute("aria-label", `Вариант ${String.fromCharCode(65 + optionIndex)}: ${option}`);
      input.addEventListener("change", () => {
        answers.set(question.sourceQuestion, option);
        renderAnswerFeedback(question);
        updateProgress();
      });

      const text = document.createElement("span");
      text.className = "answer-text";
      text.textContent = option;
      label.append(input, text);
      answerList.append(label);
    });
    renderAnswerFeedback(question);

    previousButton.disabled = currentIndex === 0;
    nextButton.replaceChildren();
    if (currentIndex === expectedQuestionCount - 1) {
      nextButton.append(document.createTextNode("Завершить экзамен"));
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "✓";
      nextButton.append(icon);
    } else {
      nextButton.append(document.createTextNode("Следующий вопрос"));
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "→";
      nextButton.append(icon);
    }
    updateProgress();
  }

  function startExam() {
    answers = new Map();
    currentIndex = 0;
    attempt = [];
    for (let lecture = 1; lecture <= 10; lecture += 1) {
      const lectureQuestions = questionBank.filter((question) => question.lecture === lecture);
      const selectedForLecture = shuffle(lectureQuestions).slice(0, questionCountPerLecture);
      selectedForLecture.forEach((question) => {
        attempt.push({
          ...question,
          options: shuffle([question.answer, ...question.distractors])
        });
      });
    }
    attempt = shuffle(attempt);
    renderQuestionGrid();
    renderQuestion();
    introView.classList.add("is-hidden");
    resultsView.classList.add("is-hidden");
    examView.classList.remove("is-hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function requestFinish() {
    const unanswered = expectedQuestionCount - getAnsweredCount();
    dialogMessage.textContent = unanswered
      ? `Осталось без ответа: ${unanswered}. Незавершённые вопросы будут отмечены как пропуски.`
      : "Все вопросы заполнены. После завершения можно будет посмотреть результат и разбор.";
    finishDialog.showModal();
  }

  function buildReviewCard(question, index, isCorrect) {
    const card = document.createElement("article");
    card.className = `review-card${isCorrect ? "" : " is-incorrect"}`;

    const top = document.createElement("div");
    top.className = "review-card-top";

    const source = document.createElement("span");
    source.className = "review-source";
    source.textContent = `ВОПРОС ${String(index + 1).padStart(2, "0")} · ЛЕКЦИЯ ${question.lecture}`;

    const status = document.createElement("span");
    status.className = "review-status";
    status.textContent = isCorrect ? "Верно" : answers.has(question.sourceQuestion) ? "Ошибка" : "Пропуск";
    top.append(source, status);

    const prompt = document.createElement("h3");
    prompt.className = "review-question";
    prompt.textContent = question.prompt;

    const userAnswer = document.createElement("p");
    userAnswer.className = "review-answer";
    const given = answers.get(question.sourceQuestion);
    userAnswer.append(document.createTextNode("Твой ответ: "));
    const givenText = document.createElement("strong");
    givenText.textContent = given || "Нет ответа";
    userAnswer.append(givenText);

    const correctAnswer = document.createElement("p");
    correctAnswer.className = "review-answer";
    correctAnswer.append(document.createTextNode("Правильный ответ: "));
    const correctText = document.createElement("strong");
    correctText.textContent = question.answer;
    correctAnswer.append(correctText);

    const explanation = document.createElement("p");
    explanation.className = "review-explanation";
    explanation.textContent = question.explanation;

    const citation = document.createElement("a");
    const lecturePath = window.location.protocol === "file:" ? "../Lectures/converted/" : "Lectures/converted/";
    citation.href = `${lecturePath}${encodeURIComponent(question.file)}`;
    citation.target = "_blank";
    citation.rel = "noopener noreferrer";
    citation.textContent = `Открыть источник: лекция ${question.lecture}, стр. ${question.page} ↗`;
    citation.className = "lecture-link";

    card.append(top, prompt, userAnswer, correctAnswer, explanation, citation);
    return card;
  }

  function renderReview() {
    const showIncorrectOnly = reviewFilter.value === "incorrect";
    reviewList.replaceChildren();
    let visibleCount = 0;

    attempt.forEach((question, index) => {
      const isCorrect = answers.get(question.sourceQuestion) === question.answer;
      if (showIncorrectOnly && isCorrect) {
        return;
      }
      visibleCount += 1;
      reviewList.append(buildReviewCard(question, index, isCorrect));
    });

    if (visibleCount === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-review";
      empty.textContent = "Ошибок нет — все ответы верны.";
      reviewList.append(empty);
    }
  }

  function completeExam() {
    const correctCount = attempt.reduce(
      (count, question) => count + (answers.get(question.sourceQuestion) === question.answer ? 1 : 0),
      0
    );
    const incorrectCount = expectedQuestionCount - correctCount;
    const percentage = Math.round((correctCount / expectedQuestionCount) * 100);

    document.querySelector("#score-percent").textContent = `${percentage}%`;
    document.querySelector("#score-correct").textContent = String(correctCount);
    document.querySelector("#score-incorrect").textContent = String(incorrectCount);
    document.querySelector("#score-ring").style.background =
      `conic-gradient(var(--lime) ${percentage * 3.6}deg, rgba(255, 255, 255, 0.16) 0deg)`;
    document.querySelector("#result-message").textContent =
      percentage >= 85
        ? "Отличный результат — ты уверенно ориентируешься в материалах лекций."
        : percentage >= 60
          ? "Хорошая база. Разбор поможет закрепить темы, в которых были ошибки."
          : "Это хорошая возможность увидеть, какие темы стоит повторить перед экзаменом.";

    examView.classList.add("is-hidden");
    introView.classList.add("is-hidden");
    resultsView.classList.remove("is-hidden");
    reviewFilter.value = "all";
    renderReview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  startButton.addEventListener("click", startExam);
  previousButton.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex -= 1;
      renderQuestion();
    }
  });
  nextButton.addEventListener("click", () => {
    if (currentIndex === expectedQuestionCount - 1) {
      requestFinish();
    } else {
      currentIndex += 1;
      renderQuestion();
    }
  });
  document.querySelector("#exit-button").addEventListener("click", requestFinish);
  document.querySelector("#continue-button").addEventListener("click", () => finishDialog.close());
  document.querySelector("#confirm-finish-button").addEventListener("click", () => {
    finishDialog.close();
    completeExam();
  });
  document.querySelector("#restart-button").addEventListener("click", startExam);
  reviewFilter.addEventListener("change", renderReview);
})();
