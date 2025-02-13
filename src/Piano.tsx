import { useCallback, useEffect, useRef, useState } from 'react';
import './piano.css';

async function initMIDI() {
    try {
        // Web MIDI API 접근 요청
        const midiAccess = await navigator.requestMIDIAccess();
        console.log("MIDI 권한 승인");

        // 모든 입력 장치 확인
        midiAccess.inputs.forEach((input) => {
            console.log(`MIDI Input Found: ${input.name}`);
            input.onmidimessage = (event) => handleMIDIMessage(event);
        });

        // 새로운 장치가 연결될 때 이벤트 리스너 추가
        midiAccess.onstatechange = (event) => {
            console.log(`MIDI Device Changed: ${event.port.name} - ${event.port.state}`);
        };
    } catch (error) {
        console.error("MIDI Access Denied:", error);
    }
}

const NOTES: Note[] = [];

// MIDI 메시지 핸들러
function handleMIDIMessage(event: Event) {
    const midimessage = event as unknown as {data: Uint8Array | null}; 

    if (!midimessage.data) return;
    const [status, note, velocity] = Array.from(midimessage.data);
    const command = status & 0xf0;

    // 데이터 노트를 기반으로 해당 노트 찾기
    const key = document.querySelector(`[data-note="${note}"]`) as HTMLLIElement; 
    if (command === 0x90 && velocity > 0) {
        key.classList.add("active");
        const order = key.getAttribute('data-order');
        NOTES.push(new Note(note, Number(order)));
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        key.classList.remove("active");
        for (let i = NOTES.length - 1;  i >= 0; i--) {
            if (NOTES[i].note === note) {
                NOTES[i].isPress = false;
            }
        }
    }
}


// 건반 생성 
const KEYS = ["A", "B", "C", "D", "E", "F", "G"];
const SEMI_KEYS = ["A", "C", "D", "F", "G"];

class Note {
    note: number;
    order: number;
    y: number;
    isPress: boolean;
    duration: number;
    constructor(note: number, order:number) {
        this.note = note;
        this.order = order;
        this.y = window.innerHeight - 164;  
        this.isPress = true;  
        this.duration = 0
    }
}

function Piano() {
    const blackKeysRef = useRef<HTMLUListElement>(null); 
    const whiteKeysRef = useRef<HTMLUListElement>(null); 

    const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // 88건반 피아노 구성
    const generateKey = useCallback((black: HTMLUListElement, white: HTMLUListElement) => {
        let isBlack = false;
        let index = 0;
        let number = 21;
        const fragmentBlack = document.createDocumentFragment(); // 반음을 위한 fragment
        const fragmentWhite = document.createDocumentFragment(); // 온음을 위한 fragment
        
        for (let i = 0; i < 103; i++) {
            const note = KEYS[index];
            const key = document.createElement("li");
            const span = document.createElement("div");

            key.appendChild(span);
            key.setAttribute("data-order", `${i}`);
            
            if (isBlack) {
                if (SEMI_KEYS.includes(note)) {
                    key.className = `black-key`;
                    key.setAttribute("data-note", `${number++}`); // 각 키에 data-note 속성 추가
                } 
                fragmentBlack.appendChild(key); // 블랙 키는 fragment에 추가
                index++;
                if (index === 7) index = 0;
            } else {
                key.className = `white-key`;
                key.setAttribute("data-note", `${number++}`); // 각 키에 data-note 속성 추가
                fragmentWhite.appendChild(key); // 화이트 키는 fragment에 추가
            }
            isBlack = !isBlack;
        }

        // 모든 키를 한번에 DOM에 추가
        black.appendChild(fragmentBlack);
        white.appendChild(fragmentWhite);
    }, []);

    // 건반 생성 및 캔버스 구성
    useEffect(() => {
        if (whiteKeysRef.current?.childNodes.length) return;
        if (!canvasRef.current) return;
        initMIDI();
        const canvas: HTMLCanvasElement = canvasRef.current!;
        const context = canvas.getContext("2d") as CanvasRenderingContext2D;
        setCtx(context);
        // 추가생성 방지
        if (blackKeysRef.current && whiteKeysRef.current) generateKey(blackKeysRef.current, whiteKeysRef.current);
    }, [generateKey]);

    


    const WHITE_NOTE_WIDTH = window.innerWidth/52;
    const BLACK_NOTE_WIDTH = window.innerWidth/52*0.8;
    const NOTE_SPEED = 5;
    const CANVAS_WIDTH = window.innerWidth;
    const CANVAS_HEIGHT = window.innerHeight - 164;

    // 애니메이션 프레임 요청 및 해제
    useEffect(() => {
        let requestId: number;
        const RequestAnimation = (ctx: CanvasRenderingContext2D | null) => () => {
        if (ctx) animate(ctx);
            // 애니메이션 콜백 반복
            requestId = window.requestAnimationFrame(RequestAnimation(ctx));
        };
        // 애니메이션 초기화
        requestId = window.requestAnimationFrame(RequestAnimation(ctx));
        return () => {
            window.cancelAnimationFrame(requestId);
        };
    });

    function animate(ctx: CanvasRenderingContext2D) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); // 캔버스 초기화
        for (let i = 0; i < NOTES.length; i++) {
            const note = NOTES[i]
            const isSemi = note.order%2;
            const order = note.order;
            const width = isSemi?BLACK_NOTE_WIDTH:WHITE_NOTE_WIDTH;
            const x = isSemi?order/2*WHITE_NOTE_WIDTH:~~(order/2)*WHITE_NOTE_WIDTH+2;
            ctx.beginPath();
            ctx.rect(
                x, // x
                note.y, // y
                width, // width
                note.duration // height
            );
            ctx.strokeStyle = 'white';
            ctx.stroke();
            ctx.closePath();
            NOTES[i].y -= NOTE_SPEED;
            if (note.isPress) NOTES[i].duration += NOTE_SPEED;
            
            if(note.y+note.duration < 2) NOTES.splice(i, 1)
        }
    }

    return (
        <div className="wrap">
            <canvas id="rain" ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}/>
            <div id="piano">
                <ul className="black-keys" ref={blackKeysRef}></ul>
                <ul className="white-keys" ref={whiteKeysRef}></ul>
            </div>
        </div>
    );
}

export default Piano;
