// ゲームの状態を管理するオブジェクト
const game = {
    scenario: null,
    currentScene: null,
    isChoiceMode: false,
    narrationEnabled: true,
    narrationVoice: null,
    currentNarration: null,
    narrationRate: 1.0,  // 読み上げ速度
    narrationPitch: 1.0, // 音程
    currentNarrationAudio: null, // カスタムナレーション音声
    
    // シナリオデータをロード
    async loadScenario() {
        try {
            const response = await fetch('scenario.json');
            if (!response.ok) {
                throw new Error('シナリオデータのロードに失敗しました');
            }
            this.scenario = await response.json();
            this.setupNarration();
            this.startGame();
        } catch (error) {
            console.error('エラー:', error);
            document.getElementById('dialog').textContent = 'シナリオデータのロードに失敗しました。';
        }
    },
    
    // 音声ナレーションの設定
    setupNarration() {
        // 音声合成APIをサポートしているか確認
        if ('speechSynthesis' in window) {
            // 利用可能な音声を取得
            const voices = window.speechSynthesis.getVoices();
            
            // 日本語の音声を探す
            const japaneseVoice = voices.find(voice => voice.lang === 'ja-JP');
            
            // 日本語の音声があれば設定、なければデフォルト音声を使用
            this.narrationVoice = japaneseVoice || voices[0];
            
            // 音声が空の場合（初回ロード時など）は音声リストのロードイベントを設定
            if (voices.length === 0) {
                window.speechSynthesis.onvoiceschanged = () => {
                    const newVoices = window.speechSynthesis.getVoices();
                    const newJapaneseVoice = newVoices.find(voice => voice.lang === 'ja-JP');
                    this.narrationVoice = newJapaneseVoice || newVoices[0];
                };
            }
            
            // ナレーションコントロールUIを追加
            this.setupNarrationControls();
        } else {
            console.warn('このブラウザは音声合成をサポートしていません');
            this.narrationEnabled = false;
            
            // ナレーションコントロールを非表示
            const narrationControls = document.getElementById('narration-controls');
            if (narrationControls) {
                narrationControls.style.display = 'none';
            }
        }
    },
    
    // ナレーションコントロールUIのセットアップ
    setupNarrationControls() {
        const controls = document.getElementById('narration-controls');
        if (!controls) {
            // コントロールUIが存在しない場合は作成
            const controlsDiv = document.createElement('div');
            controlsDiv.id = 'narration-controls';
            controlsDiv.innerHTML = `
                <button id="toggle-narration">ナレーション: オン</button>
                <div class="slider-container">
                    <label>速度: </label>
                    <input type="range" id="narration-rate" min="0.5" max="2" step="0.1" value="1">
                    <span id="rate-value">1.0</span>
                </div>
            `;
            // #controlsではなく#game-container直下に追加
            document.getElementById('game-container').appendChild(controlsDiv);
            
            // トグルボタンのイベントリスナー
            document.getElementById('toggle-narration').addEventListener('click', () => {
                this.narrationEnabled = !this.narrationEnabled;
                document.getElementById('toggle-narration').textContent = 
                    `ナレーション: ${this.narrationEnabled ? 'オン' : 'オフ'}`;
                
                // ナレーションが無効になった場合、現在の読み上げを停止
                if (!this.narrationEnabled && this.currentNarration) {
                    window.speechSynthesis.cancel();
                }
            });
            
            // 速度スライダーのイベントリスナー
            document.getElementById('narration-rate').addEventListener('input', (e) => {
                this.narrationRate = parseFloat(e.target.value);
                document.getElementById('rate-value').textContent = this.narrationRate.toFixed(1);
                
                // 現在のナレーションに適用
                if (this.currentNarration && this.narrationEnabled) {
                    // 現在の読み上げを一旦停止
                    window.speechSynthesis.cancel();
                    
                    // 新しい速度で読み上げを再開
                    this.speakText(document.getElementById('dialog').textContent);
                }
            });
        }
    },
    
    // テキストを音声で読み上げる
    speakText(text) {
        if (!this.narrationEnabled || !('speechSynthesis' in window)) {
            return;
        }
        
        // 現在の読み上げを停止
        window.speechSynthesis.cancel();
        
        // 新しい発話オブジェクトを作成
        const utterance = new SpeechSynthesisUtterance(text);
        
        // 音声を設定
        if (this.narrationVoice) {
            utterance.voice = this.narrationVoice;
        }
        
        // 速度と音程を設定
        utterance.rate = this.narrationRate;
        utterance.pitch = this.narrationPitch;
        
        // 発話を開始
        window.speechSynthesis.speak(utterance);
        
        // 現在のナレーションを保存
        this.currentNarration = utterance;
    },
    
    // ゲーム開始
    startGame() {
        this.showScene('intro');
    },
    
    // シーンを表示
    showScene(sceneId) {
        // シーンを検索
        const scene = this.scenario.scenes.find(scene => scene.id === sceneId);
        if (!scene) {
            console.error(`シーンが見つかりません: ${sceneId}`);
            return;
        }
        
        this.currentScene = scene;
        
        // 既存のナレーションを停止
        if (this.currentNarration) {
            window.speechSynthesis.cancel();
            this.currentNarration = null;
        }
        // 既存のカスタムナレーション音声を停止
        if (this.currentNarrationAudio) {
            this.currentNarrationAudio.pause();
            this.currentNarrationAudio.currentTime = 0;
            this.currentNarrationAudio = null;
        }
        
        // 背景を設定
        if (scene.background) {
            document.getElementById('background').style.backgroundImage = `url('${scene.background}')`;
        }
        
        // キャラクターを設定
        const characterElem = document.getElementById('character');
        if (scene.character) {
            characterElem.src = scene.character;
            characterElem.style.display = 'block';
        } else {
            characterElem.style.display = 'none';
        }
        
        // 話者を設定
        document.getElementById('speaker').textContent = scene.speaker || '';
        
        // テキストを設定
        document.getElementById('dialog').textContent = scene.text;
        
        // ナレーション（カスタム音声 or Web Speech API）
        if (scene.narration) {
            // カスタム音声ファイルが指定されている場合
            this.currentNarrationAudio = new Audio(scene.narration);
            this.currentNarrationAudio.play();
        } else if (scene.text) {
            // テキスト読み上げ（従来通り）
            let narrateText = scene.text;
            if (scene.speaker && scene.speaker !== 'あなた') {
                narrateText = `${scene.speaker}。${narrateText}`;
            }
            this.speakText(narrateText);
        }
        
        // 選択肢の表示/非表示を切り替え
        this.isChoiceMode = !!scene.choices;
        const choicesContainer = document.getElementById('choices-container');
        
        if (this.isChoiceMode) {
            // 選択肢を表示
            choicesContainer.innerHTML = '';
            choicesContainer.style.display = 'flex';
            
            scene.choices.forEach(choice => {
                const button = document.createElement('button');
                button.className = 'choice-btn';
                button.textContent = choice.text;
                button.addEventListener('click', () => {
                    this.showScene(choice.next);
                    choicesContainer.style.display = 'none';
                });
                choicesContainer.appendChild(button);
            });
            
            // 次へボタンを非表示
            document.getElementById('next-btn').style.display = 'none';
        } else {
            // 選択肢を非表示
            choicesContainer.style.display = 'none';
            
            // 次へボタンを表示
            document.getElementById('next-btn').style.display = 'block';
        }
    },
    
    // 次のシーンへ
    nextScene() {
        if (this.isChoiceMode || !this.currentScene.next) {
            return;
        }
        
        this.showScene(this.currentScene.next);
    }
};

// BGM用Audioオブジェクトをグローバルに用意
let bgmAudio = null;

// ゲーム開始時の処理
document.addEventListener('DOMContentLoaded', () => {
    // BGMの初期化と再生
    bgmAudio = new Audio('src/assets/audio/main_theme.mp3');
    bgmAudio.loop = true;
    bgmAudio.volume = 0.5; // 音量はお好みで
    // 自動再生ブロック対策（ユーザー操作後に再生推奨）
    bgmAudio.play().catch(e => {
        // 自動再生がブロックされた場合、最初のユーザー操作で再生
        const resumeBGM = () => {
            bgmAudio.play();
            window.removeEventListener('click', resumeBGM);
        };
        window.addEventListener('click', resumeBGM);
    });

    // 既存の「次へ」ボタンやシナリオロード処理
    document.getElementById('next-btn').addEventListener('click', () => {
        game.nextScene();
    });
    game.loadScenario();
});

// キーボードイベント（スペースキーで次へ）
document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !game.isChoiceMode) {
        game.nextScene();
    }
});