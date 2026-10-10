
/* SikeyyOS Desktop Manager */

const desktop = document.querySelector("#desktop");
const appWindow = document.querySelector("#calculator-window");
const titlebar = document.querySelector("#calculator-titlebar");

const desktopIcon = document.querySelector("#calculator-icon");
const dockButton = document.querySelector("#dock-calculator");
const taskbarButton = document.querySelector("#calculator-task");

const closeButton = document.querySelector("#close-calculator");
const minimizeButton = document.querySelector("#minimize-calculator");
const maximizeButton = document.querySelector("#maximize-calculator");

const display = document.querySelector("#display");
const previousExpression = document.querySelector("#previous-expression");

let zIndex = 10;
let expression = "";
let justCalculated = false;
let lastAnswer = 0;
let minimized = false;
let maximized = false;
let savedBounds = null;

/* Window management */

function focusWindow() {
    zIndex++;
    appWindow.style.zIndex = zIndex;
    taskbarButton.classList.remove("minimized");
}

function syncTaskbar() {
    taskbarButton.hidden = appWindow.hidden;
    taskbarButton.classList.toggle("minimized", minimized);
}

function openCalculator() {
    if (appWindow.hidden) {
        appWindow.hidden = false;
        minimized = false;
        syncTaskbar();
        focusWindow();
        return;
    }

    if (minimized) {
        restoreCalculator();
    } else {
        focusWindow();
    }
}

function closeCalculator() {
    appWindow.hidden = true;
    minimized = false;
    syncTaskbar();
}

function minimizeCalculator() {
    if (appWindow.hidden) return;

    minimized = true;
    appWindow.hidden = true;
    syncTaskbar();
}

function restoreCalculator() {
    appWindow.hidden = false;
    minimized = false;
    syncTaskbar();
    focusWindow();
}

function maximizeCalculator() {
    if (appWindow.hidden) return;

    if (!maximized) {
        savedBounds = {
            left: appWindow.style.left,
            top: appWindow.style.top,
            transform: appWindow.style.transform,
            width: appWindow.style.width,
            height: appWindow.style.height
        };

        appWindow.classList.add("maximized");
        maximized = true;
    } else {
        appWindow.classList.remove("maximized");

        appWindow.style.left = savedBounds.left;
        appWindow.style.top = savedBounds.top;
        appWindow.style.transform = savedBounds.transform;
        appWindow.style.width = savedBounds.width;
        appWindow.style.height = savedBounds.height;

        savedBounds = null;
        maximized = false;
    }

    focusWindow();
}

desktopIcon.addEventListener("click", openCalculator);
dockButton.addEventListener("click", openCalculator);

taskbarButton.addEventListener("click", () => {
    if (minimized || appWindow.hidden) {
        restoreCalculator();
    } else {
        focusWindow();
    }
});

closeButton.addEventListener("click", closeCalculator);
minimizeButton.addEventListener("click", minimizeCalculator);
maximizeButton.addEventListener("click", maximizeCalculator);

appWindow.addEventListener("pointerdown", focusWindow);

/* Drag the application window */

titlebar.addEventListener("pointerdown", event => {
    if (event.target.closest("button") || maximized) return;

    event.preventDefault();
    focusWindow();

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = appWindow.offsetLeft;
    const startTop = appWindow.offsetTop;

    titlebar.setPointerCapture(event.pointerId);

    function move(event) {
        const maxLeft = Math.max(
            0, desktop.clientWidth - appWindow.offsetWidth
        );

        const maxTop = Math.max(
            0, desktop.clientHeight - appWindow.offsetHeight
        );

        appWindow.style.left = Math.max(
            0,
            Math.min(maxLeft, startLeft + event.clientX - startX)
        ) + "px";

        appWindow.style.top = Math.max(
            0,
            Math.min(maxTop, startTop + event.clientY - startY)
        ) + "px";

        appWindow.style.transform = "none";
    }

    function stop() {
        titlebar.removeEventListener("pointermove", move);
        titlebar.removeEventListener("pointerup", stop);
        titlebar.removeEventListener("pointercancel", stop);
    }

    titlebar.addEventListener("pointermove", move);
    titlebar.addEventListener("pointerup", stop);
    titlebar.addEventListener("pointercancel", stop);
});

/* Calculator display */

function render(value = expression || "0") {
    display.textContent = value;
}

function clearCalculator() {
    expression = "";
    justCalculated = false;
    previousExpression.textContent = "\u00a0";
    render("0");
}

function appendDigit(digit) {
    if (justCalculated) {
        expression = "";
        justCalculated = false;
        previousExpression.textContent = "\u00a0";
    }

    if (expression.length >= 100) return;

    expression += digit;
    render(expression);
}

function appendDecimal() {
    if (justCalculated) {
        expression = "";
        justCalculated = false;
    }

    const lastNumber = expression.split(/[+\-*/]/).pop();

    if (lastNumber.includes(".")) return;

    if (!expression || /[+\-*/]$/.test(expression)) {
        expression += "0";
    }

    expression += ".";
    render(expression);
}

function appendOperator(operator) {
    if (!expression) {
        if (operator === "-") {
            expression = "-";
            render(expression);
        }
        return;
    }

    justCalculated = false;

    if (/[+\-*/]$/.test(expression)) {
        expression = expression.slice(0, -1);
    }

    expression += operator;
    render(expression);
}

function deleteLast() {
    if (justCalculated) {
        clearCalculator();
        return;
    }

    expression = expression.slice(0, -1);
    render(expression);
}

function toggleSign() {
    if (!expression || justCalculated) {
        expression = String(-lastAnswer);
        justCalculated = false;
        render(expression);
        return;
    }

    const match = expression.match(/(\d*\.?\d+)$/);

    if (!match) return;

    const start = match.index;
    const before = expression.slice(0, start);
    const number = match[0];

    if (before.endsWith("-") &&
        (before.length === 1 || /[+*/]$/.test(before.slice(0, -1)))) {
        expression = before.slice(0, -1) + number;
    } else {
        expression = before + "(-" + number + ")";
    }

    // Parentheses are supported by the expression parser below.
    render(expression);
}

function applyPercent() {
    if (!expression) return;

    const match = expression.match(/(\d*\.?\d+)$/);

    if (!match) return;

    const start = match.index;
    const value = Number(match[0]) / 100;

    expression = expression.slice(0, start) + String(value);
    justCalculated = false;
    render(expression);
}

/* Safe arithmetic parser: supports precedence and parentheses */

function calculate(source) {
    const tokens = source.match(
        /\d*\.?\d+(?:e[+-]?\d+)?|[()+*/-]/gi
    );

    if (!tokens || tokens.join("") !== source.replace(/\s/g, "")) {
        throw new Error("Invalid expression");
    }

    let position = 0;

    function factor() {
        const token = tokens[position++];

        if (token === "+") return factor();
        if (token === "-") return -factor();

        if (token === "(") {
            const value = addSubtract();

            if (tokens[position++] !== ")") {
                throw new Error("Missing parenthesis");
            }

            return value;
        }

        if (token === undefined || !Number.isFinite(Number(token))) {
            throw new Error("Invalid number");
        }

        return Number(token);
    }

    function multiplyDivide() {
        let value = factor();

        while (tokens[position] === "*" || tokens[position] === "/") {
            const operator = tokens[position++];
            const right = factor();

            if (operator === "/" && right === 0) {
                throw new Error("Division by zero");
            }

            value = operator === "*" ? value * right : value / right;
        }

        return value;
    }

    function addSubtract() {
        let value = multiplyDivide();

        while (tokens[position] === "+" || tokens[position] === "-") {
            const operator = tokens[position++];
            const right = multiplyDivide();

            value = operator === "+" ? value + right : value - right;
        }

        return value;
    }

    const result = addSubtract();

    if (position !== tokens.length || !Number.isFinite(result)) {
        throw new Error("Invalid expression");
    }

    return result;
}

function formatNumber(value) {
    if (Object.is(value, -0)) value = 0;

    return Number(value.toPrecision(12)).toString();
}

function calculateResult() {
    if (!expression) return;

    try {
        const result = calculate(expression);
        const formatted = formatNumber(result);

        previousExpression.textContent = expression + " =";
        expression = formatted;
        lastAnswer = result;
        justCalculated = true;

        render(formatted);
    } catch {
        previousExpression.textContent = "Invalid calculation";
        expression = "";
        justCalculated = false;
        render("Error");
    }
}

/* Keypad interactions */

document.querySelectorAll(".calc-key").forEach(button => {
    button.addEventListener("click", () => {
        const action = button.dataset.action;
        const value = button.dataset.value;

        switch (action) {
            case "digit":
                appendDigit(value);
                break;
            case "decimal":
                appendDecimal();
                break;
            case "operator":
                appendOperator(value);
                break;
            case "clear":
                clearCalculator();
                break;
            case "delete":
                deleteLast();
                break;
            case "sign":
                toggleSign();
                break;
            case "percent":
                applyPercent();
                break;
            case "equals":
                calculateResult();
                break;
        }
    });
});

/* Keyboard support */

document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    if (event.key === "Escape") {
        clearCalculator();
        return;
    }

    if (/^\d$/.test(event.key)) {
        appendDigit(event.key);
        return;
    }

    if (event.key === ".") {
        appendDecimal();
        return;
    }

    if (["+", "-", "*", "/"].includes(event.key)) {
        appendOperator(event.key);
        return;
    }

    if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        calculateResult();
        return;
    }

    if (event.key === "Backspace") {
        deleteLast();
        return;
    }

    if (event.key === "%") {
        applyPercent();
    }
});

/* Live clock */

const clock = document.querySelector("#clock");

function updateClock() {
    clock.textContent = new Intl.DateTimeFormat([], {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date());
}

updateClock();
setInterval(updateClock, 1000);
