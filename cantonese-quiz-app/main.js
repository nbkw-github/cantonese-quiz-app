document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素の取得 ---
    const startScreen = document.getElementById('start-screen');
    const quizScreen = document.getElementById('quiz-screen');
    const resultScreen = document.getElementById('result-screen');
    const quizTypeSelection = document.getElementById('quiz-type-selection');
    const categorySelectionContainer = document.getElementById('category-selection-container');
    const categorySelection = document.getElementById('category-selection');
    const vocabQuizBtn = document.getElementById('vocab-quiz-btn');
    const listeningQuizBtn = document.getElementById('listening-quiz-btn');
    const backToTypeSelectionBtn = document.getElementById('back-to-type-selection-btn');
    const weakPointQuizBtn = document.getElementById('weak-point-quiz-btn');
    const topRightControls = document.getElementById('top-right-controls');
    const homeBtn = document.getElementById('home-btn');
    const audioToggleBtn = document.getElementById('audio-toggle-btn');
    const rateToggleBtn = document.getElementById('rate-toggle-btn');
    const actionBtn = document.getElementById('action-btn');
    const restartBtn = document.getElementById('restart-btn');
    const scoreEl = document.getElementById('score');
    const totalQuestionsEl = document.getElementById('total-questions');
    const feedbackEl = document.getElementById('feedback');
    const finalScoreEl = document.getElementById('final-score');

    // クイズレイアウト
    const vocabQuizLayout = document.getElementById('vocab-quiz-layout');
    const listeningBuildLayout = document.getElementById('listening-build-layout');

    // 単語クイズ用
    const questionEl = document.getElementById('question');
    const optionsContainer = document.getElementById('options-container');

    // リスニングクイズ用
    const listeningAudioContainer = document.getElementById('listening-audio-container');
    const listeningAnswerArea = document.getElementById('listening-answer-area');
    const listeningWordBank = document.getElementById('listening-word-bank');

    // --- アプリケーションの状態管理 ---
    const appState = {
        allQuestions: [],
        activeQuestions: [],
        currentQuestionIndex: 0,
        score: 0,
        answerChecked: false,
        actionButtonState: 'confirm', // 'confirm' or 'next'
        isAudioEnabled: localStorage.getItem('audioEnabled') !== 'false',
        currentAudioRate: localStorage.getItem('audioRate') ? parseFloat(localStorage.getItem('audioRate')) : 0.9,
        tokenizer: null, // kuromojiのトークナイザ
        currentQuizType: '',
        wordBankSortable: null, // SortableJSのインスタンス用
        answerAreaSortable: null, // SortableJSのインスタンス用
        selectedOptionButton: null, // 単語クイズで選択されたボタン
    };

    // 状態を更新し、必要に応じてUIを再描画するヘルパー関数
    function setState(key, value) {
        appState[key] = value;
        // ここにUI更新ロジックを追加することも可能（例: switch文でkeyに応じて特定のUIを更新）
    }

    // --- 初期化処理 ---
    function initializeApp() {
        updateAudioToggleIcon(appState.isAudioEnabled);
        updateAudioRateIcon(appState.currentAudioRate);

        // イベントリスナー
        audioToggleBtn.addEventListener('click', toggleAudio);
        rateToggleBtn.addEventListener('click', toggleAudioRate);
        homeBtn.addEventListener('click', goHome);
        actionBtn.addEventListener('click', handleActionClick);
        restartBtn.addEventListener('click', goHome);
        vocabQuizBtn.addEventListener('click', () => showCategorySelection('vocabulary'));
        listeningQuizBtn.addEventListener('click', () => showCategorySelection('listening_build'));
        weakPointQuizBtn.addEventListener('click', startWeakPointQuiz);
        backToTypeSelectionBtn.addEventListener('click', showQuizTypeSelection);

        // データとライブラリの読み込み
        fetch('quiz-data.json')
            .then(res => res.json())
            .then(data => {
                setState('allQuestions', data);
                showQuizTypeSelection();
            })
            .catch(error => {
                console.error('クイズデータの読み込みに失敗しました:', error);
                startScreen.innerHTML = '<p>クイズデータの読み込みに失敗しました。</p>';
            });
    }

    // --- 画面遷移と表示 ---

    function showQuizTypeSelection() {
        quizTypeSelection.classList.remove('hidden');
        categorySelectionContainer.classList.add('hidden');
        startScreen.classList.remove('hidden');
        quizScreen.classList.add('hidden');
        resultScreen.classList.add('hidden');
    }

    function showCategorySelection(quizType) {
        setState('currentQuizType', quizType);
        quizTypeSelection.classList.add('hidden');
        categorySelectionContainer.classList.remove('hidden');
        displayCategories(quizType);
    }

    function displayCategories(quizType) {
        categorySelection.innerHTML = '';
        const categories = ['すべて', ...new Set(appState.allQuestions.filter(q => q.type === quizType).map(q => q.category))];
        categories.forEach(category => {
            const button = document.createElement('button');
            button.textContent = category;
            button.classList.add('category-btn');
            button.addEventListener('click', () => startQuiz(category));
            categorySelection.appendChild(button);
        });
    }

    function goHome() {
        if (!quizScreen.classList.contains('hidden')) {
            const isConfirmed = confirm('現在のクイズを中断して、トップに戻りますか？');
            if (!isConfirmed) return;
        }
        showQuizTypeSelection();
    }

    async function startWeakPointQuiz() {
        // kuromojiの読み込みチェック（リスニング問題の場合のみ必要だが、念のため）
        if (!appState.tokenizer) {
            listeningQuizBtn.disabled = true;
            listeningQuizBtn.textContent = 'リスニング問題（辞書読み込み中...）';
            try {
                setState('tokenizer', await new Promise((resolve, reject) => {
                    kuromoji.builder({ dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/" }).build((err, t) => {
                        if (err) {
                            console.error('kuromojiの初期化に失敗しました', err);
                            reject(err);
                        } else {
                            resolve(t);
                        }
                    });
                }));
            } catch (error) {
                alert('リスニング問題に必要な辞書の読み込みに失敗しました。\n恐れ入りますが、ページをリロードして再度お試しください。');
                listeningQuizBtn.disabled = false;
                listeningQuizBtn.textContent = 'リスニング問題';
                return;
            }
            listeningQuizBtn.disabled = false;
            listeningQuizBtn.textContent = 'リスニング問題';
        }

        const weakQuestions = getWeakQuestions();
        if (weakQuestions.length === 0) {
            alert('現在、弱点問題はありません。通常のクイズをプレイして、弱点問題を作成しましょう！');
            return;
        }

        setState('currentQuizType', 'weak_point'); // 新しいクイズタイプを設定
        setState('activeQuestions', shuffleArray(weakQuestions).slice(0, 10)); // 弱点問題をシャッフルして10問に絞る
        setState('currentQuestionIndex', 0);
        setState('score', 0);
        startScreen.classList.add('hidden');
        resultScreen.classList.add('hidden');
        quizScreen.classList.remove('hidden');
        totalQuestionsEl.textContent = appState.activeQuestions.length;
        showQuestion();
    }

    // --- クイズのコアロジック ---

    async function startQuiz(category) {
        let questionPool = appState.allQuestions.filter(q => q.type === appState.currentQuizType);
        if (category !== 'すべて') {
            questionPool = questionPool.filter(q => q.category === category);
        }

        if (questionPool.length === 0) {
            alert('このカテゴリには問題がありません。');
            return;
        }

        // リスニング問題の場合、kuromojiの読み込みを遅延させる
        if (appState.currentQuizType === 'listening_build' && !appState.tokenizer) {
            listeningQuizBtn.disabled = true;
            listeningQuizBtn.textContent = 'リスニング問題（辞書読み込み中...）';
            try {
                setState('tokenizer', await new Promise((resolve, reject) => {
                    kuromoji.builder({ dicPath: "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/" }).build((err, t) => {
                        if (err) {
                            console.error('kuromojiの初期化に失敗しました', err);
                            reject(err);
                        } else {
                            resolve(t);
                        }
                    });
                }));
            } catch (error) {
                alert('リスニング問題に必要な辞書の読み込みに失敗しました。\n恐れ入りますが、ページをリロードして再度お試しください。');
                listeningQuizBtn.disabled = false;
                listeningQuizBtn.textContent = 'リスニング問題';
                return;
            }
            listeningQuizBtn.disabled = false;
            listeningQuizBtn.textContent = 'リスニング問題';
        }

        setState('activeQuestions', shuffleArray(questionPool).slice(0, 10));
        setState('currentQuestionIndex', 0);
        setState('score', 0);
        startScreen.classList.add('hidden');
        resultScreen.classList.add('hidden');
        quizScreen.classList.remove('hidden');
        totalQuestionsEl.textContent = appState.activeQuestions.length;
        showQuestion();
    }

    function showQuestion() {
        resetState();
        scoreEl.textContent = appState.score;
        const question = appState.activeQuestions[appState.currentQuestionIndex];

        // 問題タイプに応じて表示を切り替え
        if (question.type === 'listening_build') {
            vocabQuizLayout.classList.add('hidden');
            listeningBuildLayout.classList.remove('hidden');
            showListeningBuildQuestion(question);
        } else {
            listeningBuildLayout.classList.add('hidden');
            vocabQuizLayout.classList.remove('hidden');
            showVocabQuestion(question);
        }
    }

    function showNextQuestion() {
        setState('currentQuestionIndex', appState.currentQuestionIndex + 1);
        if (appState.currentQuestionIndex < appState.activeQuestions.length) {
            showQuestion();
        } else {
            showResult();
        }
    }

    function handleActionClick() {
        if (appState.actionButtonState === 'confirm') {
            checkAnswer();
        } else {
            showNextQuestion();
        }
    }

    function checkAnswer() {
        const question = appState.activeQuestions[appState.currentQuestionIndex];
        if (question.type === 'listening_build') {
            checkListeningBuildAnswer(question);
        } else {
            checkVocabAnswer(question);
        }
    }

    // --- 単語クイズ関連 ---

    function showVocabQuestion(question) {
        questionEl.textContent = `「${question.jp}」`;
        const options = getVocabOptions(question);
        options.forEach(option => {
            const button = document.createElement('button');
            button.classList.add('option-btn');
            button.innerHTML = `<span class="jyutping">${option.jyutping}</span><span class="char">${option.cn}</span>`;
            button.addEventListener('click', (e) => handleVocabOptionClick(e.currentTarget, option));
            optionsContainer.appendChild(button);
        });
    }

    function handleVocabOptionClick(button, option) {
        speak(option.cn);
        if (appState.answerChecked) return;
        if (appState.selectedOptionButton) {
            appState.selectedOptionButton.classList.remove('selected');
        }
        setState('selectedOptionButton', button);
        appState.selectedOptionButton.classList.add('selected');

        setState('actionButtonState', 'confirm');
        actionBtn.textContent = 'こたえあわせ';
        actionBtn.classList.remove('is-next');
        actionBtn.classList.remove('hidden');
    }

    function checkVocabAnswer(question) {
        if (!appState.selectedOptionButton) return;
        setState('answerChecked', true);
        const correctAnswer = question.cn;
        const selectedChar = appState.selectedOptionButton.querySelector('.char').textContent;

        if (selectedChar === correctAnswer) {
            setState('score', appState.score + 1);
            feedbackEl.textContent = '✅ 正解！';
            feedbackEl.className = 'correct';
        } else {
            appState.selectedOptionButton.classList.add('wrong');
            feedbackEl.textContent = `❌ 不正解（正解は「${correctAnswer}」）`;
            feedbackEl.className = 'wrong';
        }

        Array.from(optionsContainer.children).forEach(button => {
            if (button.querySelector('.char').textContent === correctAnswer) {
                button.classList.add('correct');
            }
            button.disabled = true;
        });

        scoreEl.textContent = appState.score;
        setState('actionButtonState', 'next');
        actionBtn.textContent = '次へ';
        actionBtn.classList.add('is-next');
    }

    function getVocabOptions(question) {
        let options = [{ cn: question.cn, jyutping: question.jyutping }];
        const wrongOptionCount = 3;
        let potentialWrongOptions = appState.allQuestions.filter(q => q.type === 'vocabulary' && q.cn !== question.cn);

        options = options.concat(shuffleArray(potentialWrongOptions).slice(0, wrongOptionCount));
        return shuffleArray(options);
    }

    // --- リスニングクイズ関連 ---
    function showListeningBuildQuestion(question) {
        // 音声再生ボタン
        const playBtn = document.createElement('button');
        playBtn.id = 'play-audio-btn';
        playBtn.innerHTML = '&#9654;'; // Play icon
        playBtn.addEventListener('click', () => speak(question.cn_sentence));
        listeningAudioContainer.appendChild(playBtn);

        // 単語を分割してバンクを作成
        const correctSentences = question.correct_sentences_jp || [];
        const wordSet = new Set();

        correctSentences.forEach(sentence => {
            const tokens = appState.tokenizer.tokenize(sentence);
            tokens.forEach(token => {
                if (token.pos !== '記号') {
                    wordSet.add(token.surface_form);
                }
            });
        });

        const distractorWords = question.distractor_words_jp || [];
        distractorWords.forEach(word => wordSet.add(word));

        const allWords = Array.from(wordSet).sort();

        allWords.forEach(word => {
            const tile = createWordTile(word);
            listeningWordBank.appendChild(tile);
        });

        updateAnswerAreaPlaceholder();

        // SortableJSの初期化
        setState('wordBankSortable', new Sortable(listeningWordBank, {
            group: 'shared', // 両方のリストを同じグループに設定
            animation: 150,
            onEnd: function (evt) {
                updateAnswerAreaPlaceholder();
            }
        }));

        setState('answerAreaSortable', new Sortable(listeningAnswerArea, {
            group: 'shared',
            animation: 150,
            onAdd: function (evt) {
                // アイテムが追加されたら、プレースホルダーのテキストを削除
                const answerPlaceholder = listeningAnswerArea.querySelector('.placeholder');
                if (answerPlaceholder) answerPlaceholder.remove();
            },
            onEnd: function (evt) {
                updateAnswerAreaPlaceholder();
            }
        }));

        setState('actionButtonState', 'confirm');
        actionBtn.textContent = 'こたえあわせ';
        actionBtn.classList.remove('is-next');
        actionBtn.classList.remove('hidden');
    }

    function createWordTile(word) {
        const tile = document.createElement('div');
        tile.textContent = word;
        tile.classList.add('word-tile');
        tile.dataset.word = word;
        return tile;
    }

    function updateAnswerAreaPlaceholder() {
        const placeholderText = '下の単語をタップかドラッグして文章を組み立てよう';

        const oldPlaceholder = listeningAnswerArea.querySelector('.placeholder');
        if (oldPlaceholder) oldPlaceholder.remove();

        if (listeningAnswerArea.children.length === 0) {
            const p = document.createElement('div');
            p.textContent = placeholderText;
            p.classList.add('word-tile', 'placeholder');
            listeningAnswerArea.appendChild(p);
        }
    }

    function checkListeningBuildAnswer(question) {
        setState('answerChecked', true);
        const answerTiles = Array.from(listeningAnswerArea.querySelectorAll('.word-tile:not(.placeholder)'));
        const userAnswer = answerTiles.map(tile => tile.textContent).join('');

        const correctSentences = (question.correct_sentences_jp || []).map(sentence => {
            const tokens = appState.tokenizer.tokenize(sentence);
            return tokens.filter(t => t.pos !== '記号').map(t => t.surface_form).join('');
        });

        const isCorrect = correctSentences.includes(userAnswer);

        feedbackEl.innerHTML = ''; // Clear previous feedback

        if (isCorrect) {
            setState('score', appState.score + 1);
            feedbackEl.className = 'correct';
            const resultP = document.createElement('p');
            resultP.textContent = '✅ 正解！';
            feedbackEl.appendChild(resultP);
        } else {
            feedbackEl.className = 'wrong';
            const resultP = document.createElement('p');
            resultP.textContent = '❌ 不正解...';
            feedbackEl.appendChild(resultP);

            // 正解の表示（不正解時のみ）
            const displayCorrectSentence = question.correct_sentences_jp[0];
            const correctDiv = document.createElement('p');
            correctDiv.textContent = `正解: ${displayCorrectSentence}`;
            feedbackEl.appendChild(correctDiv);
        }

        // もとの広東語の文章を表示
        const originalSentenceDiv = document.createElement('p');
        originalSentenceDiv.className = 'feedback-original-sentence';
        originalSentenceDiv.textContent = `(${question.cn_sentence})`;
        feedbackEl.appendChild(originalSentenceDiv);

        // 学習履歴を保存
        saveQuizResult(question.id, isCorrect);

        // すべてのタイルを操作不能に
        if (appState.wordBankSortable) appState.wordBankSortable.option('disabled', true);
        if (appState.answerAreaSortable) appState.answerAreaSortable.option('disabled', true);

        scoreEl.textContent = appState.score;
        setState('actionButtonState', 'next');
        actionBtn.textContent = '次へ';
        actionBtn.classList.add('is-next');
    }


    // --- ユーティリティ ---

    // クイズ結果をlocalStorageに保存
    function saveQuizResult(questionId, isCorrect) {
        const history = getQuizHistory();
        history.push({ questionId, isCorrect, timestamp: Date.now() });
        localStorage.setItem('quizHistory', JSON.stringify(history));
    }

    // localStorageからクイズ履歴を読み込む
    function getQuizHistory() {
        const history = localStorage.getItem('quizHistory');
        return history ? JSON.parse(history) : [];
    }

    // 弱点問題を抽出する
    function getWeakQuestions() {
        const history = getQuizHistory();
        const questionStats = {}; // { questionId: { correct: N, incorrect: M } }

        // 各問題の正誤数を集計
        history.forEach(record => {
            if (!questionStats[record.questionId]) {
                questionStats[record.questionId] = { correct: 0, incorrect: 0 };
            }
            if (record.isCorrect) {
                questionStats[record.questionId].correct++;
            } else {
                questionStats[record.questionId].incorrect++;
            }
        });

        const weakQuestionIds = [];
        for (const questionId in questionStats) {
            const stats = questionStats[questionId];
            const totalAttempts = stats.correct + stats.incorrect;
            // 少なくとも5回挑戦していて、かつ正答率が50%未満の問題を弱点とする
            if (totalAttempts >= 5 && (stats.correct / totalAttempts) < 0.5) {
                weakQuestionIds.push(parseInt(questionId));
            }
        }

        // 弱点問題IDに対応する問題オブジェクトを抽出
        const weakQuestions = appState.allQuestions.filter(q => weakQuestionIds.includes(q.id));

        return weakQuestions;
    }

    function resetState() {
        setState('answerChecked', false);
        setState('selectedOptionButton', null);
        actionBtn.classList.add('hidden');
        feedbackEl.innerHTML = '&nbsp;';
        feedbackEl.className = '';

        // SortableJSインスタンスを破棄
        if (appState.wordBankSortable) appState.wordBankSortable.destroy();
        if (appState.answerAreaSortable) appState.answerAreaSortable.destroy();
        setState('wordBankSortable', null);
        setState('answerAreaSortable', null);

        // コンテナをクリア
        [optionsContainer, listeningAudioContainer, listeningAnswerArea, listeningWordBank].forEach(container => {
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        });
    }

    function shuffleArray(array) {
        let newArray = array.slice();
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    function speak(text) {
        if (!appState.isAudioEnabled) return;
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-HK';
        utterance.rate = appState.currentAudioRate;
        speechSynthesis.speak(utterance);
    }

    function toggleAudio() {
        setState('isAudioEnabled', !appState.isAudioEnabled);
        localStorage.setItem('audioEnabled', appState.isAudioEnabled);
        updateAudioToggleIcon(appState.isAudioEnabled);
    }

    function updateAudioToggleIcon(isAudioEnabled) {
        audioToggleBtn.innerHTML = isAudioEnabled ? '&#128266;' : '&#128263;';
    }

    function toggleAudioRate() {
        setState('currentAudioRate', (appState.currentAudioRate === 0.9) ? 1.2 : 0.9);
        localStorage.setItem('audioRate', appState.currentAudioRate);
        updateAudioRateIcon(appState.currentAudioRate);
    }

    function updateAudioRateIcon(currentAudioRate) {
        rateToggleBtn.innerHTML = (currentAudioRate === 0.9) ? '&#128034;' : '&#128007;';
    }

    function showResult() {
        quizScreen.classList.add('hidden');
        resultScreen.classList.remove('hidden');
        finalScoreEl.textContent = `あなたのスコア：${appState.activeQuestions.length}問中${appState.score}問正解`;
    }

    // --- アプリケーション開始 ---
    initializeApp();
});
