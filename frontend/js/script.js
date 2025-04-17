
document.addEventListener("DOMContentLoaded", () => {
    fetch("/balance")
        .then(res => res.json())
        .then(data => {
            document.getElementById("balance").innerText = `$${parseFloat(data.totalEquityValue).toFixed(2)}`;
        });

    fetch("/positions")
        .then(res => res.json())
        .then(data => {
            const table = document.getElementById("positions");
            data.positions.forEach(pos => {
                const row = `<tr>
                    <td>${pos.symbol}</td>
                    <td>${pos.side}</td>
                    <td>${pos.size} BTC</td>
                    <td>$${parseFloat(pos.entryPrice).toFixed(2)}</td>
                </tr>`;
                table.innerHTML += row;
            });
        });
});
