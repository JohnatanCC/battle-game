export class BGMPlayer {
    private ctx: AudioContext;
    private masterGain: GainNode;
    private isPlaying: boolean = false;
    private nextNoteTime: number = 0;
    private beatNumber: number = 0;
    private totalBeats: number = 0;
    private timerID: number | undefined;
    private audioElement: HTMLAudioElement;
    private usingFallback: boolean = false;
    
    // Scary, slow, tension tempo
    private tempo: number = 75; // BPM
    private lookahead: number = 25.0; // ms
    private scheduleAheadTime: number = 0.1; // s

    // Dissonant, creepy scale (Phrygian dominant-ish + diminished)
    // C, Db, E, F, Gb, G, Bb, B
    private notes = [
        261.63, 277.18, 329.63, 349.23, 369.99, 392.00, 466.16, 493.88, // C4 to B4
        523.25, 554.37, 659.25, 698.46, 739.99, 783.99, 932.33, 987.77 // C5 to B5
    ];
    
    // Creepy chords
    // 0: C diminished-ish (C, Gb, B)
    // 1: Db minor (Db, E, G)
    // 2: Bb minor add b9 (Bb, B, F)
    // 3: E diminished (E, Bb, Db)
    private chords = [
        [0, 4, 7], // C, Gb, B
        [1, 2, 5], // Db, E, G
        [6, 7, 3], // Bb, B, F
        [2, 6, 1], // E, Bb, Db
    ];

    private volume: number = 0.5;

    constructor(url: string = 'game_music.mp3', initialVolume: number = 0.5) {
        this.volume = Math.max(0, Math.min(1, initialVolume));
        this.audioElement = new Audio(url);
        this.audioElement.loop = true;
        this.audioElement.volume = this.volume;

        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.25 * this.volume;
        
        // heavy reverb/delay for spooky atmosphere
        const delay = this.ctx.createDelay();
        delay.delayTime.value = 0.6; // longer delay
        const delayFeedback = this.ctx.createGain();
        delayFeedback.gain.value = 0.6; // heavy feedback
        
        delay.connect(delayFeedback);
        delayFeedback.connect(delay);
        delay.connect(this.masterGain);
        
        this.masterGain.connect(this.ctx.destination);
    }

    public setVolume(volume: number) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.audioElement) {
            this.audioElement.volume = this.volume;
        }
        if (this.masterGain) {
            this.masterGain.gain.value = 0.25 * this.volume;
        }
    }

    public getVolume(): number {
        return this.volume;
    }

    public play() {
        if (this.isPlaying) return;
        this.isPlaying = true;

        this.audioElement.play().catch((e) => {
            console.log('Failed to play music:', e);
            // DO NOT fallback to synth anymore, let it be silent so it doesn't conflict with custom tracks
        });
    }

    public stop() {
        this.isPlaying = false;
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        if (this.timerID !== undefined) {
            window.clearTimeout(this.timerID);
        }
    }

    private playFallback() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.beatNumber = 0;
        this.scheduler();
    }

    private nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += secondsPerBeat * 0.25; // 16th notes
        this.beatNumber++;
        this.totalBeats++;
        if (this.beatNumber >= 64) {
            this.beatNumber = 0;
            // keep tempo stable and scary, no crazy ramping
        }
    }

    private playTone(freq: number, type: OscillatorType, time: number, duration: number, vol: number) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.value = freq;
        
        // Creepy slow attack envelope
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(vol, time + duration * 0.3); // very slow attack
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration); // long decay
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(time);
        osc.stop(time + duration);
    }
    
    // A quick punchy sound for heartbeats / drops
    private playPerc(freq: number, time: number, vol: number) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(10, time + 0.2); // pitch drop
        
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    private scheduleNote(beatNumber: number, time: number) {
        const barNumber = Math.floor(beatNumber / 16);
        const chordInfo = this.chords[barNumber];
        
        // Intensity increases over 4 phases
        // Phase 1 (0-256 beats, ~1 min): Base creepy vibe
        // Phase 2 (256-512 beats): Add chaotic high string stabs
        // Phase 3 (512-768 beats): Add heavy percussion rhythm
        // Phase 4 (768+ beats): Add epic choir-like synth layer and increase tempo slightly
        const phase = Math.floor(this.totalBeats / 256);
        
        if (phase >= 3) {
            this.tempo = 90; // Speeds up when epic
        } else if (phase >= 1) {
            this.tempo = 80; // Slightly faster
        }
        
        // Play eerie drone
        if (beatNumber % 16 === 0) {
            const padDuration = (60.0 / this.tempo) * 4;
            // Play very low dissonant chord
            chordInfo.forEach(noteIdx => {
                const freq = this.notes[noteIdx] / 4; // very low
                this.playTone(freq, 'sawtooth', time, padDuration, 0.15);
                this.playTone(freq * 1.01, 'triangle', time, padDuration, 0.1); // detuned layer
            });
        }

        // Play creepy high arpeggio occasionally
        if (beatNumber % 4 === 0) {
            const noteChoice = chordInfo[Math.floor(Math.random() * chordInfo.length)];
            let freq = this.notes[noteChoice];
            
            // Randomly jump an octave higher for a "screech"
            if (Math.random() > 0.7) {
                freq = this.notes[noteChoice] * 2;
            }
            
            const pianoDuration = (60.0 / this.tempo) * 2.0;
            this.playTone(freq, 'sine', time, pianoDuration, 0.15);
        }
        
        // Deep heartbeat pulse
        if (beatNumber % 16 === 0 || beatNumber % 16 === 6) {
            this.playPerc(60, time, 0.5);
            this.playPerc(50, time + 0.1, 0.4);
        }
        
        // Phase 1: High string stabs
        if (phase >= 1) {
            if (beatNumber % 8 === 4) {
                const screechFreq = this.notes[chordInfo[1]] * 2;
                this.playTone(screechFreq, 'sawtooth', time, 0.1, 0.2); // sharp attack
            }
        }
        
        // Phase 2: Heavy percussion
        if (phase >= 2) {
            if (beatNumber % 4 === 0) {
                this.playPerc(40, time, 0.6); // Kick
            }
            if (beatNumber % 8 === 4) {
                // Snare-like burst (using high frequency sine that drops fast)
                this.playPerc(300, time, 0.4);
            }
        }
        
        // Phase 3: Epic choir/synth pad layer
        if (phase >= 3) {
            if (beatNumber % 8 === 0) {
                const padDuration = (60.0 / this.tempo) * 2;
                // Add a square wave layer an octave up
                chordInfo.forEach(noteIdx => {
                    const freq = this.notes[noteIdx] / 2; // Mid octave
                    this.playTone(freq, 'square', time, padDuration, 0.1);
                });
            }
            // Driving 16th note bass
            if (beatNumber % 2 === 0) {
                const rootFreq = this.notes[chordInfo[0]] / 8;
                this.playTone(rootFreq, 'square', time, 0.2, 0.15);
            }
        }
    }

    private scheduler = () => {
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.beatNumber, this.nextNoteTime);
            this.nextNote();
        }
        
        if (this.isPlaying) {
            this.timerID = window.setTimeout(this.scheduler, this.lookahead);
        }
    }
}
