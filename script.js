// script.js

// ==========================================
// 1. ESTRUTURA DE MEMÓRIA DO CLP (IEC 61131-3)
// ==========================================
const PLC = {
    inputs: {
        I0_0: false, // Botoeira Ligar (NA)
        I0_1: true,  // Botoeira Desligar (NF - Normal Fechado)
        I0_2: false, // Sensor Nível Alto S2 (NA) - 90%
        I0_3: false  // Sensor Nível Baixo S1 (NA) - <= 20%
    },
    outputs: {
        Q0_0: false, // Válvula de Entrada Y1
        Q0_1: false  // Sinalizador de Alarme Tanque Cheio
    }
};

// ==========================================
// 2. PARÂMETROS DA PLANTA FÍSICA
// ==========================================
const Plant = {
    waterLevel: 0,        // Nível em porcentagem (0 a 100%)
    inflowRate: 0.4,      // Taxa de enchimento por ciclo
    outflowRate: 0.6,     // Taxa de esvaziamento por dreno
    isDraining: false     // Estado da válvula manual de dreno
};

// ==========================================
// 3. CAPTURA UNIVERSAL DE EVENTOS (TOUCH, MOUSE, TECLADO)
// ==========================================
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnDrain = document.getElementById('btn-drain');

function attachPointerEvents(element, onActivate, onDeactivate) {
    element.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        element.setPointerCapture(e.pointerId);
        onActivate();
    });

    element.addEventListener('pointerup', () => { onDeactivate(); });
    element.addEventListener('pointercancel', () => { onDeactivate(); });

    element.addEventListener('keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            onActivate();
        }
    });

    element.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            onDeactivate();
        }
    });
}

// Botoeiras
attachPointerEvents(btnStart, () => { PLC.inputs.I0_0 = true; }, () => { PLC.inputs.I0_0 = false; });
attachPointerEvents(btnStop, () => { PLC.inputs.I0_1 = false; }, () => { PLC.inputs.I0_1 = true; });
attachPointerEvents(btnDrain, () => { Plant.isDraining = true; }, () => { Plant.isDraining = false; });

// ==========================================
// 4. CONTROLE DO MODAL DO MANUAL
// ==========================================
const manualDialog = document.getElementById('manual-dialog');
const btnOpenManual = document.getElementById('btn-open-manual');
const btnCloseManual = document.getElementById('btn-close-manual');
const btnCloseManualFooter = document.getElementById('btn-close-manual-footer');

btnOpenManual.addEventListener('click', () => {
    manualDialog.showModal();
});

function closeModal() {
    manualDialog.close();
    btnOpenManual.focus();
}

btnCloseManual.addEventListener('click', closeModal);
btnCloseManualFooter.addEventListener('click', closeModal);

manualDialog.addEventListener('click', (event) => {
    const rect = manualDialog.getBoundingClientRect();
    const isInDialog = (rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX && event.clientX <= rect.left + rect.width);
    if (!isInDialog) {
        closeModal();
    }
});

// ==========================================
// 5. CICLO DE VARREDURA DO CLP (SCAN CYCLE)
// ==========================================
function plcScanCycle() {
    const startTime = performance.now();

    // ETAPA A: LEITURA DAS ENTRADAS
    PLC.inputs.I0_2 = Plant.waterLevel >= 90; // Sensor Nível Alto S2
    PLC.inputs.I0_3 = Plant.waterLevel <= 20; // Sensor Nível Baixo S1

    // ETAPA B: EXECUÇÃO LADDER
    // Selo com Auto-Enchimento: Q0.0 = I0.1 AND (I0.0 OR I0.3 OR Q0.0) AND NOT(I0.2)
    PLC.outputs.Q0_0 = PLC.inputs.I0_1 && (PLC.inputs.I0_0 || PLC.inputs.I0_3 || PLC.outputs.Q0_0) && !PLC.inputs.I0_2;

    // Alarme: Q0.1 = I0.2
    PLC.outputs.Q0_1 = PLC.inputs.I0_2;

    // ETAPA C: ATUALIZAÇÃO DA PLANTA FÍSICA
    updatePhysicalPlant();

    // ETAPA D: ATUALIZAÇÃO DA INTERFACE VISUAL
    updateUI();

    const scanTime = (performance.now() - startTime).toFixed(2);
    document.getElementById('scan-time').innerText = `${scanTime} ms`;
}

// ==========================================
// 6. SIMULAÇÃO FÍSICA DO TANQUE
// ==========================================
function updatePhysicalPlant() {
    if (PLC.outputs.Q0_0) {
        Plant.waterLevel = Math.min(100, Plant.waterLevel + Plant.inflowRate);
    }

    if (Plant.isDraining) {
        Plant.waterLevel = Math.max(0, Plant.waterLevel - Plant.outflowRate);
    }
}

// ==========================================
// 7. RENDERIZAÇÃO E ATUALIZAÇÕES ARIA
// ==========================================
function updateUI() {
    const ledQ00 = document.getElementById('led-q00');
    const ledQ01 = document.getElementById('led-q01');
    const ledI02 = document.getElementById('led-i02');
    const ledI03 = document.getElementById('led-i03');

    ledQ00.classList.toggle('active', PLC.outputs.Q0_0);
    ledQ00.setAttribute('aria-label', `Saída Q0.0 Válvula ${PLC.outputs.Q0_0 ? 'Ligada' : 'Desligada'}`);

    ledQ01.classList.toggle('active', PLC.outputs.Q0_1);
    ledQ01.setAttribute('aria-label', `Saída Q0.1 Alarme ${PLC.outputs.Q0_1 ? 'Ligado' : 'Desligado'}`);

    ledI02.classList.toggle('active', PLC.inputs.I0_2);
    ledI02.setAttribute('aria-label', `Sensor Nível Alto I0.2 ${PLC.inputs.I0_2 ? 'Ativado' : 'Desativado'}`);

    ledI03.classList.toggle('active', PLC.inputs.I0_3);
    ledI03.setAttribute('aria-label', `Sensor Nível Baixo I0.3 ${PLC.inputs.I0_3 ? 'Ativado' : 'Desativado'}`);

    // Destaques Lógicos no Diagrama Ladder
    document.getElementById('ladder-i01').classList.toggle('active', PLC.inputs.I0_1);
    document.getElementById('ladder-i00').classList.toggle('active', PLC.inputs.I0_0);
    document.getElementById('ladder-i03').classList.toggle('active', PLC.inputs.I0_3);
    document.getElementById('ladder-i02').classList.toggle('active', !PLC.inputs.I0_2);
    document.getElementById('ladder-q00').classList.toggle('active', PLC.outputs.Q0_0);

    document.getElementById('ladder-i02-alarm').classList.toggle('active', PLC.inputs.I0_2);
    document.getElementById('ladder-q01').classList.toggle('active', PLC.outputs.Q0_1);

    // Animações da Planta Física
    document.getElementById('tank-water').style.height = `${Plant.waterLevel}%`;
    document.getElementById('water-level-text').innerText = `${Plant.waterLevel.toFixed(1)}%`;
    
    document.getElementById('flow-in').classList.toggle('active', PLC.outputs.Q0_0);
    document.getElementById('flow-out').classList.toggle('active', Plant.isDraining);
}

// Inicializa o motor de scan a 20Hz (50ms)
setInterval(plcScanCycle, 50);
