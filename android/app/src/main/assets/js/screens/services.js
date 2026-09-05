/**
 * Eko Partner Operations — Service Flows (DMT, AePS, BBPS, Recharge)
 * Connected Platform: Writes real transactions and feeds activity + dashboard.
 */

function openServiceFlowWithContext(service, context = {}) {
    openServiceFlow(service);
    // If context contains customer info, auto-populate
    setTimeout(() => {
        if (context.customer_name) {
            const input = document.querySelector(`#${service}-form input[name=customer_name]`);
            if (input) input.value = context.customer_name;
        }
    }, 100);
}

window.openServiceFlowWithContext = openServiceFlowWithContext;
