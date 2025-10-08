// public/js/main.js
(() => {
  const cart = [];

  function renderCart() {
    const container = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    container.innerHTML = '';
    let total = 0;
    cart.forEach((it, idx) => {
      const div = document.createElement('div');
      div.className = 'd-flex justify-content-between align-items-center mb-1';
      div.innerHTML = `<div>${it.name} × ${it.qty}</div><div>$${(it.price*it.qty).toFixed(2)} <button class="btn btn-sm btn-outline-danger ms-2 remove" data-idx="${idx}">x</button></div>`;
      container.appendChild(div);
      total += it.price * it.qty;
    });
    totalEl.textContent = total.toFixed(2);
    document.getElementById('items-field').value = JSON.stringify(cart);
    document.getElementById('total-field').value = total.toFixed(2);

    container.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx, 10);
        cart.splice(idx, 1);
        renderCart();
      });
    });
  }

  document.querySelectorAll('.btn-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      const price = parseFloat(btn.dataset.price);
      const qtyEl = btn.closest('.card').querySelector('.item-qty');
      let qty = 1;
      if (qtyEl) qty = parseInt(qtyEl.value, 10) || 1;
      // merge if same item
      const found = cart.find(x => x.id === id);
      if (found) { found.qty += qty; } else { cart.push({ id, name, price, qty }); }
      renderCart();
    });
  });

  document.getElementById('order-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (cart.length === 0) return alert('Cart empty');
    const form = e.target;
    const data = {
      customer_name: form.customer_name.value,
      phone: form.phone.value,
      items: cart,
      total: parseFloat(document.getElementById('total-field').value)
    };
    fetch('/order', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(data)
    }).then(resp => {
      // server redirects to /order/:id, so follow
      if (resp.redirected) {
        window.location = resp.url;
      } else {
        resp.text().then(t => alert(t));
      }
    }).catch(err => alert('Error placing order'));
  });

  renderCart();
})();
