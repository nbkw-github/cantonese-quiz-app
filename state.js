// state.js
export const appState = {
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
export function setState(key, value) {
    appState[key] = value;
    // ここにUI更新ロジックを追加することも可能（例: switch文でkeyに応じて特定のUIを更新）
}