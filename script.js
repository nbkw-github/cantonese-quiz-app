document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const startScreen = document.getElementById('start-screen');
    const quizScreen = document.getElementById('quiz-screen');
    const resultScreen = document.getElementById('result-screen');
    const categorySelectionContainer = document.getElementById('category-selection');

    const topRightControls = document.getElementById('top-right-controls');
    const homeBtn = document.getElementById('home-btn');
    const audioToggleBtn = document.getElementById('audio-toggle-btn');
    const rateToggleBtn = document.getElementById('rate-toggle-btn');
    const actionBtn = document.getElementById('action-btn');
    const restartBtn = document.getElementById('restart-btn');

    const scoreEl = document.getElementById('score');
    const totalQuestionsEl = document.getElementById('total-questions');
    const questionEl = document.getElementById('question');
    const optionsContainer = document.getElementById('options-container');
    const feedbackEl = document.getElementById('feedback');
    const finalScoreEl = document.getElementById('final-score');

    // クイズの状態を管理する変数
    let allQuestions = [];
    let activeQuestions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let selectedOptionButton = null;
    let answerChecked = false;
    let actionButtonState = 'confirm'; // 'confirm' or 'next'
    let isAudioEnabled = localStorage.getItem('audioEnabled') === 'false' ? false : true;
    let currentAudioRate = localStorage.getItem('audioRate') ? parseFloat(localStorage.getItem('audioRate')) : 0.9;
    let audioCtx; // Added for Web Audio API

    // --- 初期化 ---
    function initializeApp() {
        updateAudioToggleIcon();
        updateAudioRateIcon();
        topRightControls.classList.add('hidden');

        // イベントリスナーの設定
        audioToggleBtn.addEventListener('click', toggleAudio);
        rateToggleBtn.addEventListener('click', toggleAudioRate);
        homeBtn.addEventListener('click', goHome);
        actionBtn.addEventListener('click', handleActionClick);
        restartBtn.addEventListener('click', goHome);

        fetch('quiz-data.json')
            .then(response => response.json())
            .then(data => {
                allQuestions = data;
                displayCategories();
            })
            .catch(error => {
                console.error('クイズデータの読み込みに失敗しました:', error);
                categorySelectionContainer.innerHTML = '<p>クイズデータの読み込みに失敗しました。</p>';
            });
    }

    // カテゴリ選択画面を表示
    function displayCategories() {
        categorySelectionContainer.innerHTML = '';
        const categories = ['すべて', ...new Set(allQuestions.map(q => q.category))];
        categories.forEach(category => {
            const button = document.createElement('button');
            button.textContent = category;
            button.classList.add('category-btn');
            button.addEventListener('click', () => startQuiz(category));
            categorySelectionContainer.appendChild(button);
        });
    }

    // アクションボタンのクリック処理
    function handleActionClick() {
        if (actionButtonState === 'confirm') {
            checkAnswer();
        } else {
            showNextQuestion();
        }
    }

    // ホーム画面に戻る
    function goHome() {
        if (!quizScreen.classList.contains('hidden')) {
            const isConfirmed = confirm('現在のクイズを中断して、カテゴリ選択に戻りますか？');
            if (!isConfirmed) return;
        }
        topRightControls.classList.add('hidden');
        resultScreen.classList.add('hidden');
        quizScreen.classList.add('hidden');
        startScreen.classList.remove('hidden');
        displayCategories();
    }

    // 音声設定の切り替え
    function toggleAudio() {
        isAudioEnabled = !isAudioEnabled;
        localStorage.setItem('audioEnabled', isAudioEnabled);
        updateAudioToggleIcon();
    }

    function updateAudioToggleIcon() {
        audioToggleBtn.innerHTML = isAudioEnabled ? '&#128266;' : '&#128263;';
    }

    // 音声スピードの切り替え
    function toggleAudioRate() {
        currentAudioRate = (currentAudioRate === 0.9) ? 1.2 : 0.9; // 0.9 (遅い) と 1.2 (速い) を切り替える
        localStorage.setItem('audioRate', currentAudioRate);
        updateAudioRateIcon();
    }

    function updateAudioRateIcon() {
        rateToggleBtn.innerHTML = (currentAudioRate === 0.9) ? '&#128034;' : '&#128007;'; // 遅い場合は亀、速い場合はウサギ
    }

    // クイズ開始
    function startQuiz(category) {
        let questionPool = category === 'すべて' ? allQuestions : allQuestions.filter(q => q.category === category);
        if (questionPool.length === 0) {
            alert('このカテゴリには問題がありません。');
            return;
        }
        activeQuestions = shuffleArray(questionPool).slice(0, 10);
        currentQuestionIndex = 0;
        score = 0;
        startScreen.classList.add('hidden');
        resultScreen.classList.add('hidden');
        quizScreen.classList.remove('hidden');
        topRightControls.classList.remove('hidden');
        totalQuestionsEl.textContent = activeQuestions.length;
        showQuestion();
    }

    // 問題を表示
    function showQuestion() {
        resetState();
        const question = activeQuestions[currentQuestionIndex];
        questionEl.textContent = `「${question.jp}」は広東語で？`;
        scoreEl.textContent = score;
        const options = getOptions(question);
        options.forEach(option => {
            const button = document.createElement('button');
            button.classList.add('option-btn');
            button.innerHTML = `<span class="jyutping">${option.jyutping}</span><span class="char">${option.cn}</span>`;
            button.addEventListener('click', () => handleOptionClick(button, option));
            optionsContainer.appendChild(button);
        });
    }

    // 選択肢のクリック処理
    function handleOptionClick(button, option) {
        speak(option.cn);
        if (answerChecked) return;
        if (selectedOptionButton) {
            selectedOptionButton.classList.remove('selected');
        }
        selectedOptionButton = button;
        selectedOptionButton.classList.add('selected');
        
        // アクションボタンを「こたえあわせ」モードに設定
        actionButtonState = 'confirm';
        actionBtn.textContent = 'こたえあわせ';
        actionBtn.classList.remove('is-next');
        actionBtn.classList.remove('hidden');
    }

    // 回答をチェック
    function checkAnswer() {
        if (!selectedOptionButton) return;
        answerChecked = true;
        const correctAnswer = activeQuestions[currentQuestionIndex].cn;
        const selectedChar = selectedOptionButton.querySelector('.char').textContent;

        if (selectedChar === correctAnswer) {
            score++;
            feedbackEl.textContent = '✅ 正解！';
            feedbackEl.className = 'correct';
        } else {
            selectedOptionButton.classList.add('wrong');
            feedbackEl.textContent = `❌ 不正解（正解は「${correctAnswer}」）`;
            feedbackEl.className = 'wrong';
        }

        Array.from(optionsContainer.children).forEach(button => {
            if (button.querySelector('.char').textContent === correctAnswer) {
                button.classList.add('correct');
            }
        });
        
        scoreEl.textContent = score;

        // アクションボタンを「次へ」モードに設定
        actionButtonState = 'next';
        actionBtn.textContent = '次へ';
        actionBtn.classList.add('is-next');
    }

    // 選択肢を生成
    function getOptions(question) {
        let options = [{ cn: question.cn, jyutping: question.jyutping }];
        const wrongOptionCount = 3;
        let potentialWrongOptions = [];

        // 1. 同じタグを持つ単語を優先的に探す
        if (question.tags && question.tags.length > 0) {
            const tagMatchedOptions = allQuestions.filter(q => 
                q.cn !== question.cn && // 正解自身は除外
                q.tags && q.tags.some(tag => question.tags.includes(tag)) // 共通のタグを持つ
            );
            potentialWrongOptions = potentialWrongOptions.concat(shuffleArray(tagMatchedOptions));
        }

        // 2. 同じカテゴリを持つ単語を探す（タグで足りない場合）
        if (potentialWrongOptions.length < wrongOptionCount) {
            const existingCns = options.concat(potentialWrongOptions).map(o => o.cn);
            const categoryMatchedOptions = allQuestions.filter(q => 
                !existingCns.includes(q.cn) && // 既存の選択肢は除外
                q.category === question.category // 同じカテゴリ
            );
            potentialWrongOptions = potentialWrongOptions.concat(shuffleArray(categoryMatchedOptions));
        }

        // 3. それでも足りなければ、残りの全単語からランダムに補充
        if (potentialWrongOptions.length < wrongOptionCount) {
            const existingCns = options.concat(potentialWrongOptions).map(o => o.cn);
            const allRemainingOptions = allQuestions.filter(q => !existingCns.includes(q.cn));
            potentialWrongOptions = potentialWrongOptions.concat(shuffleArray(allRemainingOptions));
        }

        // 最終的に必要な数だけ不正解の選択肢を選び、シャッフルして返す
        options = options.concat(shuffleArray(potentialWrongOptions).slice(0, wrongOptionCount));
        return shuffleArray(options);
    }

    // 配列をシャッフル
    function shuffleArray(array) {
        let newArray = array.slice();
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    // テキストを音声で読み上げ
    function speak(text) {
        if (!isAudioEnabled) return;
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-HK';
        utterance.rate = currentAudioRate;
        speechSynthesis.speak(utterance);
    }

    // 次の問題へ
    function showNextQuestion() {
        currentQuestionIndex++;
        if (currentQuestionIndex < activeQuestions.length) {
            showQuestion();
        } else {
            showResult();
        }
    }

    // 結果を表示
    function showResult() {
        quizScreen.classList.add('hidden');
        resultScreen.classList.remove('hidden');
        topRightControls.classList.add('hidden');
        finalScoreEl.textContent = `あなたのスコア：${activeQuestions.length}問中${score}問正解`;
    }

    // 表示をリセット
    function resetState() {
        selectedOptionButton = null;
        answerChecked = false;
        actionBtn.classList.add('hidden');
        feedbackEl.innerHTML = '&nbsp;';
        feedbackEl.className = '';
        while (optionsContainer.firstChild) {
            optionsContainer.removeChild(optionsContainer.firstChild);
        }
    }

    // アプリケーションの初期化
    initializeApp();
});
