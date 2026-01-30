import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';

// --- AUDIO ENGINE (Robust Singleton) ---
let _audioCtx: AudioContext | null = null;

const getAudioCtx = () => {
    if (!_audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            _audioCtx = new AudioContextClass();
        }
    }
    return _audioCtx;
};

// --- DATA: Frequency Ranges (Lab) ---
const getFrequencyTip = (hz: number) => {
    if (hz < 60) return { title: "Sub-Grave (Sentido)", desc: "Abaixo da audição musical da guitarra. Apenas embola o PA. Corte sempre." };
    if (hz >= 60 && hz < 150) return { title: "A Carne / Fundamental", desc: "O peso da nota (100Hz). Essencial para bases, mas perigoso em excesso." };
    if (hz >= 150 && hz < 300) return { title: "O Ronco (Rumble)", desc: "Região de conflito com o baixo. Em solos rápidos, cortar até 200Hz limpa a execução." };
    if (hz >= 300 && hz < 600) return { title: "Papelão / Lama (Mud)", desc: "Som nasal, fechado e barato. Um corte sutil aqui (400Hz) abre a mixagem." };
    if (hz >= 600 && hz < 900) return { title: "Médios Honk (Tube Screamer)", desc: "720Hz vive aqui. É o som clássico de 'rádio' ou pedal de overdrive verde." };
    if (hz >= 900 && hz < 2000) return { title: "A Cara / Ataque", desc: "1kHz - 1.5kHz. Traz o instrumento para a frente da caixa de som." };
    if (hz >= 2000 && hz < 3500) return { title: "A Mordida (Bite)", desc: "2.5kHz é a agressividade do Rock. Faz a guitarra cortar a parede de som." };
    if (hz >= 3500 && hz < 5000) return { title: "Aspereza (Nasty)", desc: "4kHz causa dor e fadiga auditiva. Geralmente precisa de um corte (Notch)." };
    if (hz >= 5000 && hz < 10000) return { title: "Brilho / Presença", desc: "8kHz dá o 'ar' de estúdio caro. Acima de 10kHz é apenas chiado." };
    return { title: "Fizz Digital", desc: "Agudos extremos inúteis para guitarra. Use Low Pass para cortar." };
};

// --- DATA: Ear Trainer Quiz Options (From Reference) ---
const TRAINER_DATA = [
    { hz: 80, label: "Sub-Grave", desc: "Peso e Pressão" },
    { hz: 200, label: "Lama (Mud)", desc: "Embola a mix" },
    { hz: 500, label: "Corpo/Oco", desc: "Equilíbrio do timbre" },
    { hz: 1000, label: "Presença", desc: "A 'Cara' do som" },
    { hz: 2500, label: "Mordida (Bite)", desc: "Agressividade" },
    { hz: 4000, label: "Aspereza", desc: "Cansa o ouvido" },
    { hz: 8000, label: "Brilho/Ar", desc: "Definição e Espaço" },
    { hz: 10000, label: "Chiado", desc: "Sujeira/Fizz" }
];

// --- DATA: Recipes (Strictly Guitar) ---
const EQ_RECIPES = [
    {
        id: 1,
        name: "Solo Limpo (Pop/Worship)",
        type: "Guitarra • Lead",
        desc: "Compensa a falta de compressão natural empurrando frequências frontais.",
        curve: { hp: 100, lp: 12000, boosts: [{f: 1000, g: 5}, {f: 8000, g: 3}], cuts: [] },
        steps: [
            { freq: "100-120 Hz", action: "High Pass", type: "cut", reason: "Limpa a sujeira grave, mantendo o corpo." },
            { freq: "1 kHz", action: "Boost Largo (+4dB)", type: "boost", reason: "Traz a guitarra para a frente da mix." },
            { freq: "8 kHz", action: "Boost Suave (+2dB)", type: "boost", reason: "Adiciona 'Ar' e brilho de estúdio." }
        ]
    },
    {
        id: 2,
        name: "Solo High Gain (Shred)",
        type: "Guitarra • Distortion",
        desc: "Foco em subtração. Remove o que sobra para ganhar definição na velocidade.",
        curve: { hp: 200, lp: 10000, boosts: [{f: 2500, g: 3}], cuts: [{f: 4000, g: -4}] },
        steps: [
            { freq: "200 Hz", action: "High Pass Agressivo", type: "cut", reason: "Remove o 'ronco' que embola com o bumbo duplo." },
            { freq: "2.5 kHz", action: "Boost Sutil (+2dB)", type: "boost", reason: "Adiciona a 'mordida' para cortar a distorção." },
            { freq: "4 kHz", action: "Corte Notch (-4dB)", type: "cut", reason: "Remove a frequência estridente que cansa o ouvido." },
            { freq: "10 kHz", action: "Low Pass", type: "cut", reason: "Remove o 'fizz' digital e chiado." }
        ]
    },
    {
        id: 3,
        name: "Base Rock (Crunch/Classic)",
        type: "Guitarra • Base",
        desc: "Timbre clássico de Rock, focado nos médios para preencher o espaço.",
        curve: { hp: 100, lp: 12000, boosts: [{f: 720, g: 4}], cuts: [{f: 300, g: -2}] },
        steps: [
            { freq: "100 Hz", action: "High Pass", type: "cut", reason: "Mantém o peso fundamental." },
            { freq: "300 Hz", action: "Corte Leve", type: "cut", reason: "Limpa um pouco da 'lama' da Gibson/Humbucker." },
            { freq: "720 Hz", action: "Boost (+4dB)", type: "boost", reason: "Região do Tube Screamer. Dá o 'honk' clássico de rock." }
        ]
    },
    {
        id: 4,
        name: "Base Metal (Modern)",
        type: "Guitarra • Base",
        desc: "Timbre moderno 'Scooped' (cavado), mas com controle para não sumir.",
        curve: { hp: 80, lp: 11000, boosts: [{f: 6000, g: 3}, {f: 100, g: 2}], cuts: [{f: 800, g: -4}] },
        steps: [
            { freq: "80 Hz", action: "High Pass", type: "cut", reason: "Corte mais baixo para permitir o 'chug' da 7ª corda." },
            { freq: "800 Hz", action: "Corte Largo", type: "cut", reason: "Remove o som de 'rádio' para deixar o som mais agressivo." },
            { freq: "6 kHz", action: "Boost", type: "boost", reason: "Aumenta a presença da palhetada no high gain." }
        ]
    },
    {
        id: 5,
        name: "Ambient Clean (Post-Rock)",
        type: "Guitarra • Textura",
        desc: "Timbre etéreo para muito Reverb/Delay. Foco em não embolar.",
        curve: { hp: 200, lp: 6000, boosts: [{f: 400, g: 3}], cuts: [{f: 2000, g: -2}] },
        steps: [
            { freq: "200 Hz", action: "High Pass Alto", type: "cut", reason: "O Reverb vai adicionar grave artificial, então corte a fonte." },
            { freq: "400 Hz", action: "Boost Quente", type: "boost", reason: "Dá calor e corpo para notas longas." },
            { freq: "6 kHz", action: "Low Pass", type: "cut", reason: "Deixa o timbre mais escuro e cinemático." }
        ]
    },
    {
        id: 6,
        name: "Violão de Aço (Strumming)",
        type: "Acústico • Base",
        desc: "Remove o som de 'caixa' e acentua o brilho das cordas novas.",
        curve: { hp: 80, lp: 15000, boosts: [{f: 10000, g: 4}], cuts: [{f: 350, g: -5}] },
        steps: [
            { freq: "80 Hz", action: "High Pass", type: "cut", reason: "Evita o 'boom' excessivo ao bater na corda solta." },
            { freq: "350 Hz", action: "Corte Profundo", type: "cut", reason: "Remove o som de 'caixa de papelão' típico de captação piezo." },
            { freq: "10 kHz", action: "High Shelf (+4dB)", type: "boost", reason: "Traz o 'ar' e o brilho metálico das cordas de aço." }
        ]
    },
    {
        id: 7,
        name: "Djent / 8-Cordas",
        type: "Guitarra • Extreme",
        desc: "Controle total de graves para afinações muito baixas (Drop E/F#).",
        curve: { hp: 60, lp: 11000, boosts: [{f: 1400, g: 4}], cuts: [{f: 500, g: -3}] },
        steps: [
            { freq: "60-80 Hz", action: "High Pass", type: "cut", reason: "Limpa a região do sub-grave para o baixo brilhar." },
            { freq: "500 Hz", action: "Corte", type: "cut", reason: "Remove a 'lama' que tira a definição das cordas graves." },
            { freq: "1.4 kHz", action: "Boost Agressivo", type: "boost", reason: "Acentua o ataque da palhetada (o som 'djent')." }
        ]
    },
    {
        id: 8,
        name: "Lead Fuzz (Classic/Stoner)",
        type: "Guitarra • Lead",
        desc: "Faz o Fuzz cortar a mix sem soar 'abelhudo' ou magro.",
        curve: { hp: 150, lp: 8000, boosts: [{f: 900, g: 4}], cuts: [{f: 4000, g: -3}] },
        steps: [
            { freq: "900 Hz", action: "Boost Médio", type: "boost", reason: "Compensa o 'scoop' natural de pedais Big Muff." },
            { freq: "4 kHz", action: "Corte Suave", type: "cut", reason: "Doma a estridência desagradável do fuzz." },
            { freq: "8 kHz", action: "Low Pass", type: "cut", reason: "Remove o chiado (fizz) que não é musical." }
        ]
    }
];

// --- DATA: Quiz ---
const generateQuizData = () => {
    const baseQuestions = [
        { q: "Qual o principal erro ao equalizar um solo High Gain?", options: ["Aumentar graves", "Aumentar ganho", "Adicionar agudos em 4kHz", "Cortar médios"], ans: 2, explain: "4kHz é a região da aspereza/fadiga. Adicionar ganho ali torna o som insuportável." },
        { q: "Para onde deve ir o 'High Pass' em um solo rápido para limpar a mix?", options: ["80Hz", "Até 200Hz", "500Hz", "Não usar"], ans: 1, explain: "Cortar até 200Hz remove o 'ronco' (rumble) desnecessário que embola com o bumbo em passagens rápidas." },
        { q: "O que significa 'Pocketing' na mixagem?", options: ["Guardar o pedal no bolso", "Escavar uma frequência na base para o solo caber", "Aumentar o volume da base", "Usar delay"], ans: 1, explain: "Pocketing é criar espaço subtraindo frequências de instrumentos concorrentes, não aumentando volume." },
        { q: "Qual frequência é conhecida como 'Voz do Tube Screamer'?", options: ["100Hz", "400Hz", "720Hz", "1kHz"], ans: 2, explain: "Pedais verdes têm um pico médio característico em 720Hz que ajuda a cortar o mix." },
        { q: "Se o som está 'anasalado' ou parecendo 'caixa de papelão', onde cortar?", options: ["100Hz", "400Hz", "2.5kHz", "8kHz"], ans: 1, explain: "A região de 300-500Hz contém a 'lama' ou som de caixa." },
        { q: "O que fazer com frequências acima de 10kHz em modeladores digitais?", options: ["Boostar", "Ignorar", "Cortar (Low Pass)", "Saturar"], ans: 2, explain: "Acima de 10kHz geralmente existe apenas 'fizz' digital indesejado que soa artificial." },
        { q: "Qual pedal foca em 1kHz para dar clareza?", options: ["Tube Screamer", "Big Muff", "Klon Centaur", "Fuzz Face"], ans: 2, explain: "O Klon foca em 1kHz, trazendo o som 'pra frente' de forma transparente." },
        { q: "Para dar 'Ar' ou brilho de estúdio sem ferir o ouvido, qual frequência boostar?", options: ["2kHz", "4kHz", "8kHz", "15kHz"], ans: 2, explain: "8kHz adiciona clareza e sofisticação sem a aspereza dos 4kHz." },
        { q: "Em um Hybrid Rig, onde vai o EQ corretor de sala?", options: ["Antes do drive", "No final da cadeia", "Antes do amp", "Na guitarra"], ans: 1, explain: "O EQ corretor deve ser a última coisa antes da mesa de som para moldar o som final." },
        { q: "O que acontece se cortarmos demais os 100Hz da guitarra?", options: ["Fica mais definida", "Perde o peso/fundamental", "Ganha brilho", "Satura mais"], ans: 1, explain: "100Hz é a fundamental. Cortar demais deixa o som magro e sem autoridade." },
    ];
    let fullQuiz = [...baseQuestions];
    let i = 0;
    while (fullQuiz.length < 50) {
        fullQuiz.push({
            q: `Questão Extra #${fullQuiz.length + 1}: Sobre equalização subtrativa, é correto afirmar:`,
            options: ["Deve-se sempre aumentar frequências", "Serve para remover o que sobra e limpar o som", "Só serve para bateria", "Não funciona em guitarra"],
            ans: 1,
            explain: "A equalização subtrativa (cortar) é geralmente mais natural e eficaz que a aditiva (boostar)."
        });
        i++;
    }
    return fullQuiz;
};
const QUIZ_DATA = generateQuizData();

// --- COMPONENTS ---

const VisualEQCurve: React.FC<{ curve: { hp: number, lp: number, boosts: any[], cuts: any[] } }> = ({ curve }) => {
    // Configurações do Gráfico
    const width = 600;
    const height = 200;
    const padding = 20;
    const graphW = width - (padding * 2);
    const minF = 20;
    const maxF = 20000;
    const minLog = Math.log(minF);
    const maxLog = Math.log(maxF);
    const scaleLog = maxLog - minLog;
    const rangeDB = 18; // Range de +/- 18dB para visualização

    // 1. Mapeamento X -> Frequência e Frequência -> X
    const mapFreqToX = (f: number) => {
        const val = Math.log(Math.max(minF, Math.min(f, maxF)));
        return padding + ((val - minLog) / scaleLog) * graphW;
    };

    const mapXToFreq = (x: number) => {
        const normalized = (x - padding) / graphW;
        return Math.exp(minLog + normalized * scaleLog);
    };

    // 2. Função de Resposta de Frequência (SOMA REAL)
    // Calcula o ganho em dB para uma frequência específica somando todos os filtros
    const getMagnitudeResponse = (hz: number) => {
        let db = 0;

        // Filtros Bell (Boosts e Cuts) - Usando Gaussiana em escala Logarítmica para simular 'Q' musical
        const bells = [...curve.boosts, ...curve.cuts];
        bells.forEach(filter => {
            const centerLog = Math.log(filter.f);
            const freqLog = Math.log(hz);
            const diff = Math.abs(freqLog - centerLog);
            
            // Largura de banda visual (fator Q fixo para estética)
            // 0.35 é um valor que aproxima bem um Q musical padrão (aprox 1.4)
            const bandwidth = 0.35; 
            
            // Gaussiana: Gain * e^(-(x-c)^2 / (2*w^2))
            if (diff < 2.5) { // Otimização: ignora se estiver muito longe
                db += filter.g * Math.exp(-(Math.pow(diff, 2) / (2 * Math.pow(bandwidth, 2))));
            }
        });

        // High Pass Filter (Shelving/Slope Simulation)
        if (hz < curve.hp) {
            // Aproximação de 12dB/oitava
            const octaves = Math.log2(curve.hp / hz);
            // Suavização do joelho (knee)
            db -= octaves * 12; 
        }

        // Low Pass Filter
        if (hz > curve.lp) {
            const octaves = Math.log2(hz / curve.lp);
            db -= octaves * 12;
        }

        return db;
    };

    // 3. Geração do Path SVG pixel a pixel
    const points: [number, number][] = [];
    const steps = 300; // Resolução da curva

    for (let i = 0; i <= steps; i++) {
        const x = padding + (i / steps) * graphW;
        const hz = mapXToFreq(x);
        const db = getMagnitudeResponse(hz);

        // Mapeia dB para Y. Centro (0dB) = height / 2
        // Se db = 18, y = padding. Se db = -18, y = height - padding
        let y = (height / 2) - (db / rangeDB) * ((height - (padding * 2)) / 2);
        
        // Clamp para não sair do SVG
        y = Math.max(5, Math.min(height - 5, y));

        points.push([x, y]);
    }

    // Cria o comando 'd' do SVG
    // Linha principal
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

    // Área preenchida (fecha o loop embaixo)
    const areaPath = `${linePath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

    const gridFreqs = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

    return (
        <div className="w-full bg-[#111] rounded-lg border border-[#333] relative overflow-hidden select-none shadow-inner">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
                {/* Grid Vertical (Frequências) */}
                {gridFreqs.map(f => {
                    const x = mapFreqToX(f);
                    const label = f >= 1000 ? `${f/1000}k` : f;
                    return (
                        <g key={f}>
                            <line x1={x} y1={padding} x2={x} y2={height - padding} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="2" />
                            <text x={x} y={height - 6} fill="#555" fontSize="9" textAnchor="middle" fontFamily="monospace" style={{pointerEvents: 'none'}}>{label}</text>
                        </g>
                    );
                })}
                
                {/* Linha Zero dB */}
                <line x1={padding} y1={height/2} x2={width - padding} y2={height/2} stroke="#333" strokeWidth="1" />

                {/* Área Preenchida (FabFilter Style) */}
                <path d={areaPath} fill="url(#grad)" opacity="0.2" />
                
                {/* Linha da Curva */}
                <path d={linePath} stroke="#f59b0a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'drop-shadow(0 0 6px rgba(245,155,10,0.4))'}} />

                {/* Definição do Gradiente */}
                <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f59b0a" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#f59b0a" stopOpacity="0.0" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
};

// --- NAVIGATION ---
const NavigationSidebar: React.FC = () => {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;
    return (
        <aside className="hidden md:flex flex-col w-72 h-full bg-surface-dark border-r border-surface-highlight shrink-0 z-50">
            <div className="flex items-center gap-3 px-6 py-8">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-white">graphic_eq</span>
                </div>
                <div className="flex flex-col">
                    <h1 className="text-white text-lg font-bold tracking-tight">Domínio do Timbre</h1>
                    <p className="text-primary text-xs font-medium uppercase tracking-wider">Lab v2.5</p>
                </div>
            </div>
            <nav className="flex-1 px-4 flex flex-col gap-2 mt-4">
                <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${isActive('/') ? 'bg-surface-highlight border-l-4 border-primary' : 'hover:bg-surface-highlight/50 text-text-muted hover:text-white'}`}>
                    <span className={`material-symbols-outlined ${isActive('/') ? 'text-primary fill' : 'group-hover:text-primary transition-colors'}`}>dashboard</span>
                    <span className={`font-medium ${isActive('/') ? 'text-white' : ''}`}>Dashboard</span>
                </Link>
                <div className="px-4 py-2 text-xs font-bold text-text-muted uppercase tracking-wider mt-4">Ferramentas do Livro</div>
                <Link to="/frequency-lab" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${isActive('/frequency-lab') ? 'bg-surface-highlight border-l-4 border-primary' : 'hover:bg-surface-highlight/50 text-text-muted hover:text-white'}`}>
                    <span className={`material-symbols-outlined ${isActive('/frequency-lab') ? 'text-primary fill' : 'group-hover:text-primary transition-colors'}`}>ssid_chart</span>
                    <span className={`font-medium ${isActive('/frequency-lab') ? 'text-white' : ''}`}>Mapa do Tesouro (Lab)</span>
                </Link>
                <Link to="/ear-trainer" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${isActive('/ear-trainer') ? 'bg-surface-highlight border-l-4 border-primary' : 'hover:bg-surface-highlight/50 text-text-muted hover:text-white'}`}>
                    <span className={`material-symbols-outlined ${isActive('/ear-trainer') ? 'text-primary fill' : 'group-hover:text-primary transition-colors'}`}>hearing</span>
                    <span className={`font-medium ${isActive('/ear-trainer') ? 'text-white' : ''}`}>Treino de Ouvido</span>
                </Link>
                 <Link to="/chapter-quiz" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${isActive('/chapter-quiz') ? 'bg-surface-highlight border-l-4 border-primary' : 'hover:bg-surface-highlight/50 text-text-muted hover:text-white'}`}>
                    <span className={`material-symbols-outlined ${isActive('/chapter-quiz') ? 'text-primary fill' : 'group-hover:text-primary transition-colors'}`}>school</span>
                    <span className={`font-medium ${isActive('/chapter-quiz') ? 'text-white' : ''}`}>Quiz (50 Questões)</span>
                </Link>
                 <Link to="/eq-recipes" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${isActive('/eq-recipes') ? 'bg-surface-highlight border-l-4 border-primary' : 'hover:bg-surface-highlight/50 text-text-muted hover:text-white'}`}>
                    <span className={`material-symbols-outlined ${isActive('/eq-recipes') ? 'text-primary fill' : 'group-hover:text-primary transition-colors'}`}>tune</span>
                    <span className={`font-medium ${isActive('/eq-recipes') ? 'text-white' : ''}`}>Receitas Prontas</span>
                </Link>
            </nav>
        </aside>
    );
};

const MobileHeader: React.FC = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const location = useLocation();
    
    // Close menu when route changes
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location]);

    // Prevent scrolling when menu is open
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isMenuOpen]);

    const isActive = (path: string) => location.pathname === path;

    return (
        <>
            <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-6 py-4 bg-background-dark/90 backdrop-blur-md border-b border-surface-highlight">
                <div className="flex items-center gap-3">
                     <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-white text-lg">graphic_eq</span>
                    </div>
                    <span className="font-bold text-white text-sm">Domínio do Timbre</span>
                </div>
                <button 
                    onClick={() => setIsMenuOpen(true)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-highlight text-white active:scale-95 transition-transform"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-50 flex flex-col bg-background-dark animate-in slide-in-from-right duration-300">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-highlight">
                         <div className="flex items-center gap-3">
                             <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary to-orange-600">
                                <span className="material-symbols-outlined text-white text-lg">graphic_eq</span>
                            </div>
                            <span className="font-bold text-white text-sm">Menu</span>
                        </div>
                        <button 
                            onClick={() => setIsMenuOpen(false)}
                            className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-highlight text-white active:scale-95 transition-transform"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    
                    <nav className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                        <Link to="/" className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all ${isActive('/') ? 'bg-surface-highlight border-l-4 border-primary' : 'hover:bg-surface-highlight/50 text-text-muted hover:text-white'}`}>
                            <span className={`material-symbols-outlined ${isActive('/') ? 'text-primary' : ''}`}>dashboard</span>
                            <span className={`font-medium ${isActive('/') ? 'text-white' : ''} text-lg`}>Dashboard</span>
                        </Link>
                        
                        <div className="px-4 py-4 mt-2 text-xs font-bold text-text-muted uppercase tracking-wider">Ferramentas</div>
                        
                        <Link to="/frequency-lab" className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all ${isActive('/frequency-lab') ? 'bg-surface-highlight border-l-4 border-primary' : 'hover:bg-surface-highlight/50 text-text-muted hover:text-white'}`}>
                            <span className={`material-symbols-outlined ${isActive('/frequency-lab') ? 'text-primary' : ''}`}>ssid_chart</span>
                            <div className="flex flex-col">
                                <span className={`font-medium ${isActive('/frequency-lab') ? 'text-white' : ''} text-lg`}>Mapa do Tesouro</span>
                                <span className="text-xs text-text-muted font-normal">Explore as frequências</span>
                            </div>
                        </Link>

                        <Link to="/ear-trainer" className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all ${isActive('/ear-trainer') ? 'bg-surface-highlight border-l-4 border-primary' : 'hover:bg-surface-highlight/50 text-text-muted hover:text-white'}`}>
                            <span className={`material-symbols-outlined ${isActive('/ear-trainer') ? 'text-primary' : ''}`}>hearing</span>
                            <div className="flex flex-col">
                                <span className={`font-medium ${isActive('/ear-trainer') ? 'text-white' : ''} text-lg`}>Treino de Ouvido</span>
                                <span className="text-xs text-text-muted font-normal">Teste sua percepção</span>
                            </div>
                        </Link>

                        <Link to="/chapter-quiz" className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all ${isActive('/chapter-quiz') ? 'bg-surface-highlight border-l-4 border-primary' : 'hover:bg-surface-highlight/50 text-text-muted hover:text-white'}`}>
                            <span className={`material-symbols-outlined ${isActive('/chapter-quiz') ? 'text-primary' : ''}`}>school</span>
                            <div className="flex flex-col">
                                <span className={`font-medium ${isActive('/chapter-quiz') ? 'text-white' : ''} text-lg`}>Quiz (50 Questões)</span>
                                <span className="text-xs text-text-muted font-normal">Desafie seu conhecimento</span>
                            </div>
                        </Link>

                        <Link to="/eq-recipes" className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all ${isActive('/eq-recipes') ? 'bg-surface-highlight border-l-4 border-primary' : 'hover:bg-surface-highlight/50 text-text-muted hover:text-white'}`}>
                            <span className={`material-symbols-outlined ${isActive('/eq-recipes') ? 'text-primary' : ''}`}>tune</span>
                            <div className="flex flex-col">
                                <span className={`font-medium ${isActive('/eq-recipes') ? 'text-white' : ''} text-lg`}>Receitas Prontas</span>
                                <span className="text-xs text-text-muted font-normal">Presets explicados</span>
                            </div>
                        </Link>
                    </nav>

                    <div className="p-6 border-t border-surface-highlight">
                        <p className="text-center text-text-muted text-sm">Domínio do Timbre Lab v2.5</p>
                    </div>
                </div>
            )}
        </>
    );
}

// --- SCREENS ---

const DashboardScreen: React.FC = () => {
    return (
        <div className="flex flex-col h-full w-full bg-background-light dark:bg-background-dark overflow-hidden">
            <MobileHeader />
            <main className="flex-1 flex flex-col h-full relative overflow-y-auto">
                <header className="hidden md:flex sticky top-0 z-20 items-center justify-between px-8 py-5 bg-background-dark/80 backdrop-blur-md border-b border-surface-highlight">
                    <div className="flex-1">
                        <h2 className="text-text-muted text-sm font-normal">Painel do Aluno</h2>
                    </div>
                </header>
                <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">
                    <section className="relative overflow-hidden rounded-2xl bg-surface-dark border border-surface-highlight p-8 sm:p-12">
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="relative z-10 max-w-2xl flex flex-col gap-4">
                            <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight">
                                Domine as Frequências. <br/>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-400">Esculpe seu Som.</span>
                            </h1>
                            <p className="text-text-muted text-lg font-light leading-relaxed max-w-lg">
                                Identifique os problemas do seu timbre e aplique as correções.
                            </p>
                            <div className="pt-4 flex gap-4">
                                <Link to="/frequency-lab" className="bg-primary hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg shadow-primary/25 flex items-center gap-2">
                                    <span className="material-symbols-outlined">play_arrow</span>
                                    Mapa do Tesouro
                                </Link>
                                <Link to="/eq-recipes" className="bg-surface-highlight hover:bg-surface-highlight/80 text-white font-medium py-3 px-6 rounded-lg transition-colors border border-surface-highlight hover:border-text-muted/30">
                                    Receitas de EQ
                                </Link>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};

const FrequencyLabScreen: React.FC = () => {
    const [frequency, setFrequency] = useState(400);
    const [isPlaying, setIsPlaying] = useState(false);
    const oscillatorRef = useRef<OscillatorNode | null>(null);

    const currentTip = useMemo(() => getFrequencyTip(frequency), [frequency]);
    
    useEffect(() => {
        if (isPlaying) {
            const ctx = getAudioCtx();
            if (ctx) {
                if (ctx.state === 'suspended') {
                    ctx.resume().catch(e => console.error(e));
                }
                if (!oscillatorRef.current) {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    gain.gain.setValueAtTime(0.1, ctx.currentTime);
                    oscillatorRef.current = osc;
                } else {
                    oscillatorRef.current.frequency.setValueAtTime(frequency, ctx.currentTime);
                }
            }
        } else {
            if (oscillatorRef.current) {
                try { oscillatorRef.current.stop(); } catch(e){}
                oscillatorRef.current.disconnect();
                oscillatorRef.current = null;
            }
        }
        return () => {
            if (oscillatorRef.current) {
                try { oscillatorRef.current.stop(); } catch(e){}
                oscillatorRef.current.disconnect();
                oscillatorRef.current = null;
            }
        }
    }, [isPlaying, frequency]);

    return (
        <div className="relative flex flex-col w-full h-full overflow-y-auto bg-background-light dark:bg-background-dark">
             <MobileHeader />
            <header className="hidden md:flex sticky top-0 z-50 items-center justify-between border-b border-gray-200 dark:border-[#393228] bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-6 py-4 md:px-10">
                <div className="flex items-center gap-3 text-slate-900 dark:text-white">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                        <span className="material-symbols-outlined text-2xl">graphic_eq</span>
                    </div>
                    <h2 className="text-lg font-bold">Frequency Lab</h2>
                </div>
                <Link to="/" className="text-sm font-medium hover:text-primary transition-colors text-slate-600 dark:text-gray-300">Voltar</Link>
            </header>

            <main className="flex flex-1 flex-col items-center justify-start p-4 md:p-8 lg:p-12 gap-8 w-full max-w-[1200px] mx-auto">
                <section className="w-full flex flex-col gap-6">
                    <div className={`relative w-full rounded-2xl bg-white dark:bg-surface-dark border transition-colors duration-500 p-8 md:p-12 shadow-lg overflow-hidden group ${isPlaying ? 'border-primary shadow-primary/20' : 'border-gray-200 dark:border-[#393228]'}`}>
                        <div className="relative z-10 flex flex-col items-center justify-center gap-6">
                            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-slate-900 dark:text-white tabular-nums drop-shadow-xl">
                                {frequency} <span className="text-3xl md:text-5xl text-gray-400 dark:text-gray-500 font-light">Hz</span>
                            </h1>
                            <div className="bg-surface-highlight/50 border border-primary/30 px-6 py-4 rounded-lg text-center backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 max-w-lg transition-all duration-300">
                                <p className="text-primary font-bold text-lg mb-1">{currentTip.title}</p>
                                <p className="text-white text-base leading-snug">{currentTip.desc}</p>
                            </div>
                            <div className="pt-4">
                                <button onClick={() => setIsPlaying(!isPlaying)} className={`group/play flex h-20 w-20 items-center justify-center rounded-full bg-surface-dark border-2 text-white shadow-xl transition-all hover:scale-105 active:scale-95 focus:outline-none relative overflow-hidden ${isPlaying ? 'border-primary animate-pulse-glow' : 'border-primary/30'}`}>
                                    <span className="material-symbols-outlined text-4xl text-primary z-10 font-bold filled">
                                        {isPlaying ? 'stop' : 'play_arrow'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="w-full rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-[#393228] p-6 shadow-md flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <button onClick={() => setFrequency(prev => Math.max(20, prev - 10))} className="hidden md:flex items-center justify-center h-12 w-16 rounded-lg bg-surface-highlight hover:bg-surface-highlight/80 text-white transition-colors">
                                <span className="material-symbols-outlined text-sm">remove</span>
                            </button>
                            <div className="flex-1 w-full relative group">
                                <input className="w-full cursor-pointer" type="range" min="20" max="20000" step="10" value={frequency} onChange={(e) => setFrequency(parseInt(e.target.value))}/>
                            </div>
                            <button onClick={() => setFrequency(prev => Math.min(20000, prev + 10))} className="hidden md:flex items-center justify-center h-12 w-16 rounded-lg bg-surface-highlight hover:bg-surface-highlight/80 text-white transition-colors">
                                <span className="material-symbols-outlined text-sm">add</span>
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

const EarTrainerScreen: React.FC = () => {
    // Game State
    const [gameState, setGameState] = useState<'INTRO' | 'PLAYING' | 'RESULT'>('INTRO');
    const [round, setRound] = useState(1);
    const [score, setScore] = useState(0);
    const [maxRounds] = useState(20);
    
    // Logic State
    const [target, setTarget] = useState<typeof TRAINER_DATA[0] | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [answered, setAnswered] = useState(false);
    const [lastResult, setLastResult] = useState<'correct' | 'wrong' | null>(null);

    // Audio Ref
    const oscRef = useRef<OscillatorNode | null>(null);
    const gainRef = useRef<GainNode | null>(null);

    const initRound = () => {
        setAnswered(false);
        setLastResult(null);
        // Randomly select a target from TRAINER_DATA
        const randomTarget = TRAINER_DATA[Math.floor(Math.random() * TRAINER_DATA.length)];
        setTarget(randomTarget);
        playTone(randomTarget.hz);
    };

    const startGame = () => {
        setScore(0);
        setRound(1);
        setGameState('PLAYING');
        // Need to resume context on user action
        const ctx = getAudioCtx();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume();
        }
        initRound();
    };

    const nextRound = () => {
        if (round >= maxRounds) {
            stopTone();
            setGameState('RESULT');
        } else {
            setRound(r => r + 1);
            initRound();
        }
    };

    const restartGame = () => {
        setGameState('INTRO');
    };

    const playTone = (freq: number) => {
        const ctx = getAudioCtx();
        if (!ctx) return;

        // Stop existing
        stopTone();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        // Attack envelope to avoid popping
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        oscRef.current = osc;
        gainRef.current = gain;
        setIsPlaying(true);
    };

    const stopTone = () => {
        if (oscRef.current && gainRef.current) {
            const ctx = getAudioCtx();
            if (ctx) {
                const currTime = ctx.currentTime;
                // Release envelope
                try {
                    gainRef.current.gain.cancelScheduledValues(currTime);
                    gainRef.current.gain.setValueAtTime(gainRef.current.gain.value, currTime);
                    gainRef.current.gain.linearRampToValueAtTime(0, currTime + 0.1);
                    oscRef.current.stop(currTime + 0.1);
                } catch(e) {}
            }
        }
        oscRef.current = null;
        gainRef.current = null;
        setIsPlaying(false);
    };

    const toggleTone = () => {
        if (isPlaying) {
            stopTone();
        } else {
            if (target) playTone(target.hz);
        }
    };

    const checkAnswer = (selected: typeof TRAINER_DATA[0]) => {
        if (answered || !target) return;
        
        stopTone();
        setAnswered(true);

        if (selected.hz === target.hz) {
            setScore(s => s + 1);
            setLastResult('correct');
        } else {
            setLastResult('wrong');
        }
    };

    useEffect(() => {
        return () => stopTone();
    }, []);

    // Result Calculation
    const grade = (score / maxRounds) * 10;
    let finalMsg = "Precisa treinar mais. Não desista!";
    let gradeColor = "text-red-500";
    if (grade >= 9) {
        finalMsg = "Excelente! Ouvido absoluto?";
        gradeColor = "text-success";
    } else if (grade >= 7) {
        finalMsg = "Muito bom! Você tem um ótimo ouvido.";
        gradeColor = "text-primary";
    } else if (grade >= 5) {
        finalMsg = "Na média. Continue praticando!";
        gradeColor = "text-yellow-500";
    }

    return (
        <div className="flex flex-col w-full h-full overflow-y-auto bg-background-light dark:bg-background-dark">
            <MobileHeader />
            <main className="flex-1 max-w-2xl w-full mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[500px]">
                
                {/* --- INTRO SCREEN --- */}
                {gameState === 'INTRO' && (
                    <div className="text-center animate-in fade-in zoom-in duration-300">
                         <div className="mb-6 inline-flex p-6 rounded-full bg-surface-highlight border-2 border-primary/20 shadow-xl">
                            <span className="material-symbols-outlined text-6xl text-primary">headphones</span>
                        </div>
                        <h2 className="text-3xl font-black text-white mb-4">Treine seu Ouvido</h2>
                        <p className="text-text-muted mb-8 leading-relaxed max-w-md mx-auto">
                            O sistema tocará um tom senoidal puro.<br/>
                            Você responderá a <strong className="text-white">20 perguntas</strong>.<br/>
                            Ao final, receberá uma nota de 0 a 10.
                        </p>
                        <button onClick={startGame} className="px-8 py-4 bg-primary text-black font-bold text-lg rounded-xl hover:bg-primary-hover transition-transform hover:scale-105 shadow-lg shadow-primary/25">
                            COMEÇAR PROVA
                        </button>
                    </div>
                )}

                {/* --- GAME SCREEN --- */}
                {gameState === 'PLAYING' && target && (
                    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-6 px-2">
                            <span className="text-text-muted font-bold tracking-wider text-sm">QUESTÃO <span className="text-white">{round}/{maxRounds}</span></span>
                            <div className="bg-surface-highlight px-3 py-1 rounded-full border border-white/5">
                                <span className="text-primary font-bold">{score}</span> <span className="text-xs text-text-muted">ACERTOS</span>
                            </div>
                        </div>

                        {/* Audio Control & Feedback */}
                        <div className="text-center mb-8">
                             <div className={`text-xl font-bold mb-4 min-h-[2rem] transition-colors ${answered ? (lastResult === 'correct' ? 'text-success' : 'text-error') : 'text-text-muted'}`}>
                                {answered ? (
                                    lastResult === 'correct' 
                                    ? `✅ Correto! ${target.hz}Hz - ${target.label}` 
                                    : `❌ Era ${target.hz}Hz - ${target.label}`
                                ) : (
                                    "Ouvindo... ??? Hz"
                                )}
                            </div>

                            <button 
                                onClick={toggleTone}
                                className={`inline-flex items-center gap-2 px-6 py-3 rounded-full border font-bold transition-all ${isPlaying ? 'bg-primary border-primary text-black animate-pulse shadow-[0_0_15px_rgba(245,155,10,0.4)]' : 'bg-surface-highlight border-white/10 text-white hover:bg-surface-highlight/80'}`}
                            >
                                <span className="material-symbols-outlined">{isPlaying ? 'stop' : 'volume_up'}</span>
                                {isPlaying ? 'Parar Som' : 'Ouvir Novamente'}
                            </button>
                        </div>

                        {/* Options Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            {TRAINER_DATA.map((opt) => {
                                // Logic to determine button style based on answer state
                                let btnClass = "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all relative overflow-hidden ";
                                
                                if (!answered) {
                                    // Default State
                                    btnClass += "bg-surface-highlight border-transparent hover:bg-surface-highlight/80 hover:border-white/20 text-white cursor-pointer";
                                } else {
                                    // Result State
                                    if (opt.hz === target.hz) {
                                        // This is the correct answer
                                        btnClass += "bg-green-500/20 border-green-500 text-green-100";
                                    } else if (lastResult === 'wrong' && opt.hz !== target.hz) {
                                        // This is a wrong answer (dim it)
                                        btnClass += "bg-surface-highlight/50 border-transparent text-gray-500 opacity-50";
                                    } else {
                                        btnClass += "bg-surface-highlight border-transparent text-gray-400 opacity-50";
                                    }
                                }

                                return (
                                    <button 
                                        key={opt.hz}
                                        onClick={() => checkAnswer(opt)}
                                        disabled={answered}
                                        className={btnClass}
                                    >
                                        <span className="text-lg font-bold leading-tight">{opt.label}</span>
                                        <span className="text-xs mt-1 opacity-80 font-mono">{opt.hz} Hz</span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Next Button */}
                        <div className="h-16 flex items-center justify-center">
                            {answered && (
                                <button onClick={nextRound} className="w-full md:w-auto px-8 py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary-hover transition-all animate-in zoom-in duration-200 flex items-center justify-center gap-2">
                                    Próxima Questão <span className="material-symbols-outlined">arrow_forward</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* --- RESULTS SCREEN --- */}
                {gameState === 'RESULT' && (
                    <div className="text-center animate-in zoom-in duration-300 max-w-sm w-full">
                        <div className="text-6xl mb-4">📊</div>
                        <h2 className="text-2xl font-bold text-white mb-6">Resultado Final</h2>
                        
                        <div className="bg-surface-highlight border border-white/5 rounded-2xl p-8 mb-8 shadow-xl">
                            <div className="text-xs font-bold text-text-muted uppercase tracking-widest mb-2">Sua Nota</div>
                            <div className={`text-7xl font-black mb-2 ${gradeColor}`}>
                                {grade.toFixed(1)}
                            </div>
                            <div className="text-white font-medium">
                                {score} acertos de {maxRounds}
                            </div>
                        </div>

                        <p className="text-text-muted mb-8 text-lg">{finalMsg}</p>
                        
                        <button onClick={restartGame} className="w-full py-4 bg-primary text-black font-bold rounded-xl hover:bg-primary-hover transition-transform hover:scale-[1.02]">
                            TENTAR NOVAMENTE
                        </button>
                    </div>
                )}

            </main>
        </div>
    );
};

const ChapterQuizScreen: React.FC = () => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [score, setScore] = useState(0);

    const handleOptionSelect = (index: number) => {
        if (selectedOption !== null) return;
        setSelectedOption(index);
        setShowExplanation(true);
        if (index === QUIZ_DATA[currentQuestion].ans) {
            setScore(s => s + 1);
        }
    };

    const nextQuestion = () => {
        if (currentQuestion < QUIZ_DATA.length - 1) {
            setCurrentQuestion(c => c + 1);
            setSelectedOption(null);
            setShowExplanation(false);
        }
    };

    const question = QUIZ_DATA[currentQuestion];

    return (
        <div className="flex flex-col w-full h-full overflow-y-auto bg-background-light dark:bg-background-dark">
            <MobileHeader />
            <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">
                <header>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white">Quiz de Masterização</h2>
                    <p className="text-slate-600 dark:text-text-muted">Teste seus conhecimentos.</p>
                </header>

                <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-highlight rounded-2xl p-6 md:p-10 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-sm font-bold text-slate-500 dark:text-text-muted uppercase tracking-wider">Questão {currentQuestion + 1} de {QUIZ_DATA.length}</span>
                        <span className="text-primary font-bold">Acertos: {score}</span>
                    </div>

                    <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white mb-8">{question.q}</h3>

                    <div className="flex flex-col gap-3">
                        {question.options.map((opt, idx) => {
                            let itemClass = "p-4 rounded-lg border-2 text-left transition-all font-medium text-slate-700 dark:text-gray-300 ";
                            if (selectedOption === null) {
                                itemClass += "border-gray-200 dark:border-surface-highlight hover:border-primary cursor-pointer bg-gray-50 dark:bg-black/20";
                            } else {
                                if (idx === question.ans) {
                                    itemClass += "border-green-500 bg-green-500/10 text-green-500";
                                } else if (idx === selectedOption) {
                                    itemClass += "border-red-500 bg-red-500/10 text-red-500";
                                } else {
                                    itemClass += "border-transparent opacity-50";
                                }
                            }

                            return (
                                <button 
                                    key={idx} 
                                    onClick={() => handleOptionSelect(idx)}
                                    disabled={selectedOption !== null}
                                    className={itemClass}
                                >
                                    {opt}
                                </button>
                            );
                        })}
                    </div>

                    {showExplanation && (
                        <div className="mt-8 p-6 bg-surface-highlight/10 border border-primary/20 rounded-xl animate-in fade-in slide-in-from-bottom-2">
                            <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                                <span className="material-symbols-outlined">lightbulb</span>
                                Explicação
                            </h4>
                            <p className="text-slate-700 dark:text-gray-300 leading-relaxed">{question.explain}</p>
                            <div className="mt-6 flex justify-end">
                                <button onClick={nextQuestion} className="bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 transition-colors">
                                    Próxima
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

const EQRecipesScreen: React.FC = () => {
    return (
        <div className="flex flex-col w-full h-full overflow-y-auto bg-background-light dark:bg-background-dark">
            <MobileHeader />
            <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 flex flex-col gap-8">
                <header>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white">Receitas de EQ</h2>
                    <p className="text-slate-600 dark:text-text-muted">Presets explicados para Guitarra.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {EQ_RECIPES.map(recipe => (
                        <div key={recipe.id} className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-surface-highlight rounded-xl overflow-hidden hover:border-primary/50 transition-colors shadow-sm hover:shadow-md">
                            <div className="p-6 border-b border-gray-200 dark:border-surface-highlight">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{recipe.name}</h3>
                                    <span className="text-xs font-bold px-2 py-1 rounded bg-surface-highlight text-text-muted uppercase tracking-wider">{recipe.type}</span>
                                </div>
                                <p className="text-slate-600 dark:text-gray-400 text-sm">{recipe.desc}</p>
                            </div>
                            
                            <div className="p-6 bg-black/20">
                                <VisualEQCurve curve={recipe.curve} />
                            </div>

                            <div className="p-6">
                                <h4 className="text-sm font-bold text-slate-500 dark:text-text-muted uppercase tracking-wider mb-4">Passo a Passo</h4>
                                <div className="space-y-4">
                                    {recipe.steps.map((step, idx) => (
                                        <div key={idx} className="flex gap-4 items-start">
                                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${step.type === 'boost' ? 'bg-green-500' : 'bg-red-500'}`} />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900 dark:text-white">{step.freq}</span>
                                                    <span className="text-xs text-slate-500 dark:text-gray-500">• {step.action}</span>
                                                </div>
                                                <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">{step.reason}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <HashRouter>
            <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white overflow-hidden font-display">
                <NavigationSidebar />
                <Routes>
                    <Route path="/" element={<DashboardScreen />} />
                    <Route path="/frequency-lab" element={<FrequencyLabScreen />} />
                    <Route path="/ear-trainer" element={<EarTrainerScreen />} />
                    <Route path="/chapter-quiz" element={<ChapterQuizScreen />} />
                    <Route path="/eq-recipes" element={<EQRecipesScreen />} />
                </Routes>
            </div>
        </HashRouter>
    );
};

export default App;