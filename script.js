const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQRSLkWdYOqO25SuyaGCdvfxKvoPXMRsWs9WBQ22Q_G64-DnHWdyWKEUbkbm8LirCKb0yZRT_Le-j5Q/pub?gid=1879601222&single=true&output=csv';

let listaCompleta = [];

function atualizarDataESaudacao() {
  const agora = new Date();
  
  const opcoesData = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' };
  const dataFormatada = agora.toLocaleDateString('pt-BR', opcoesData);
  document.getElementById('textoData').innerText = dataFormatada;

  const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });
  const hora = parseInt(horaStr, 10);

  let saudacao = 'Boa noite!';
  if (hora >= 5 && hora < 12) {
    saudacao = 'Bom dia!';
  } else if (hora >= 12 && hora < 18) {
    saudacao = 'Boa tarde!';
  }

  document.getElementById('textoSaudacao').innerText = saudacao;
}

function padronizarTexto(texto) {
  if (!texto) return '';

  return texto
    .toString()
    .trim()
    .toLowerCase()
    .replace(/(^|\s)([a-zá-úà-üç])/gi, (match, espaco, letra) => {
      return espaco + letra.toUpperCase();
    });
}

function formatarUrlDrive(url) {
  if (!url) return '';
  const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

function parseCSV(text) {
  const p = textLine => {
    let arr = [''], i = 0, c = false;
    for (let ch of textLine) {
      if (ch === '"') { c = !c; }
      else if (ch === ',' && !c) { arr.push(''); i++; }
      else { arr[i] += ch; }
    }
    return arr;
  };

  const lines = text.split(/\r?\n/);
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = p(lines[i]).map(c => c.replace(/^"|"$/g, '').trim());

    if (cols.length >= 2) {
      let fotoUrl = '';
      cols.forEach(c => {
        if (c.includes('drive.google.com')) {
          fotoUrl = c;
        }
      });

      const segAsex = cols[13] || cols[12] || '';
      const sabado = cols[14] || '';
      const domingo = cols[15] || '';

      let periodosList = [];
      if (segAsex && segAsex.toUpperCase() !== 'N/A' && !segAsex.includes('drive.google.com')) {
        periodosList.push(`Seg a Sex: ${segAsex}`);
      }
      if (sabado && sabado.toUpperCase() !== 'N/A') {
        periodosList.push(`Sáb: ${sabado}`);
      }
      if (domingo && domingo.toUpperCase() !== 'N/A') {
        periodosList.push(`Dom/Fer: ${domingo}`);
      }

      result.push({
        nome: cols[1] || '',
        cidade: cols[2] || '',
        profissao: cols[3] || 'Profissional da Saúde',
        especialidade: cols[3] || '',
        servicos: cols[4] || '',
        registro: cols[5] || '',
        bio: cols[6] || '',
        publico: cols[7] || '',
        modalidade: cols[8] || '',
        whatsapp: cols[9] ? cols[9].replace(/\D/g, '') : '',
        email: cols[10] || '',
        instagram: cols[11] ? cols[11].replace('@', '') : '',
        periodos: periodosList.length > 0 ? periodosList.join(' | ') : 'Não informado',
        foto: formatarUrlDrive(fotoUrl)
      });
    }
  }
  return result;
}

async function carregarDados() {
  atualizarDataESaudacao();
  try {
    const response = await fetch(CSV_URL);
    const data = await response.text();
    listaCompleta = parseCSV(data);
    
    preencherFiltros();
    renderizarCards(listaCompleta);
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    document.getElementById('gridProfissionais').innerHTML = 
      '<div style="color: red; padding: 20px;">Erro ao carregar a lista de profissionais.</div>';
  }
}

function preencherFiltros() {
  const selectProf = document.getElementById('selectProfissao');
  const selectCid = document.getElementById('selectCidade');
  const selectEsp = document.getElementById('selectEspecialidade');

  const profissoes = new Set();
  const cidades = new Set();
  const especialidades = new Set();

  listaCompleta.forEach(p => {
    if (p.profissao) profissoes.add(padronizarTexto(p.profissao));
    if (p.cidade) cidades.add(padronizarTexto(p.cidade));
    if (p.especialidade) {
      p.especialidade.split(',').forEach(e => {
        if (e.trim()) especialidades.add(padronizarTexto(e.trim()));
      });
    }
  });

  Array.from(profissoes).sort().forEach(prof => {
    selectProf.innerHTML += `<option value="${prof}">${prof}</option>`;
  });

  Array.from(cidades).sort().forEach(cid => {
    selectCid.innerHTML += `<option value="${cid}">${cid}</option>`;
  });

  Array.from(especialidades).sort().forEach(esp => {
    selectEsp.innerHTML += `<option value="${esp}">${esp}</option>`;
  });
}

function renderizarCards(profissionais) {
  const grid = document.getElementById('gridProfissionais');
  const contador = document.getElementById('contadorResultados');
  grid.innerHTML = '';
  contador.innerText = `Profissionais encontrados (${profissionais.length})`;

  if (profissionais.length === 0) {
    grid.innerHTML = `
      <div style="color: var(--text-muted); padding: 20px;">
        Nenhum profissional encontrado com os filtros selecionados.
      </div>`;
    return;
  }

  profissionais.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'prof-card';
    card.onclick = () => abrirModal(p);

    const avatarHTML = p.foto 
      ? `<img src="${p.foto}" alt="${p.nome}" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\'fa-solid fa-user\'></i>';">`
      : `<i class="fa-solid fa-user"></i>`;

    const tagsArr = p.servicos ? p.servicos.split(',').slice(0, 2) : [];
    const tagsHTML = tagsArr.map(t => `<span class="prof-tag">${padronizarTexto(t)}</span>`).join('');

    card.innerHTML = `
      <i class="fa-regular fa-heart prof-fav"></i>
      <div class="prof-avatar">${avatarHTML}</div>
      <div class="prof-body">
        <div class="prof-name" title="${p.nome}">${p.nome}</div>
        <div class="prof-profession">${padronizarTexto(p.profissao)}</div>
        ${p.especialidade ? `<div class="prof-spec">${padronizarTexto(p.especialidade)}</div>` : ''}
        <div class="prof-location"><i class="fa-solid fa-location-dot"></i> ${padronizarTexto(p.cidade) || 'Itapevi'}</div>
        <div class="prof-tags">${tagsHTML}</div>
        <div class="prof-hours"><i class="fa-regular fa-clock"></i> ${p.periodos}</div>
      </div>
    `;

    grid.appendChild(card);
  });

  const tipCard = document.createElement('div');
  tipCard.className = 'card-tip';
  tipCard.innerHTML = `
    <div class="tip-header">
      <div class="tip-icon"><i class="fa-solid fa-star"></i></div>
      <div class="tip-title">Dica de bem-estar</div>
    </div>
    <div class="tip-text">
      Cuidar da saúde mental é tão importante quanto cuidar do corpo. Encontre o apoio que você precisa!
    </div>
    <button class="btn-tip">Saiba mais</button>
  `;
  grid.appendChild(tipCard);
}

function scrollCarrossel(distancia) {
  document.getElementById('sliderContainer').scrollBy({
    left: distancia,
    behavior: 'smooth'
  });
}

function abrirModal(p) {
  document.getElementById('modalNome').innerText = p.nome || 'Sem nome';
  document.getElementById('modalRegistro').innerText = p.registro ? `Reg: ${p.registro}` : 'Sem registro';
  document.getElementById('modalBio').innerText = p.bio || '-';
  document.getElementById('modalEspecialidades').innerText = p.especialidade || '-';
  document.getElementById('modalServicos').innerText = p.servicos || '-';
  document.getElementById('modalPublico').innerText = p.publico || '-';
  document.getElementById('modalModalidade').innerText = p.modalidade || '-';
  document.getElementById('modalPeriodos').innerText = p.periodos || '-';

  const fotoContainer = document.getElementById('modalFotoContainer');
  if (p.foto) {
    fotoContainer.innerHTML = `<img src="${p.foto}" alt="${p.nome}" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\'fa-solid fa-user\'></i>';">`;
  } else {
    fotoContainer.innerHTML = `<i class="fa-solid fa-user"></i>`;
  }

  const contatosContainer = document.getElementById('modalContatos');
  contatosContainer.innerHTML = '';

  if (p.whatsapp) {
    contatosContainer.innerHTML += `
      <a href="https://wa.me/55${p.whatsapp}" target="_blank" class="contact-btn btn-whatsapp-modal">
        <i class="fa-brands fa-whatsapp"></i> WhatsApp
      </a>`;
  }
  if (p.email) {
    contatosContainer.innerHTML += `
      <a href="mailto:${p.email}" class="contact-btn btn-email-modal">
        <i class="fa-solid fa-envelope"></i> E-mail
      </a>`;
  }
  if (p.instagram) {
    contatosContainer.innerHTML += `
      <a href="https://instagram.com/${p.instagram}" target="_blank" class="contact-btn btn-instagram-modal">
        <i class="fa-brands fa-instagram"></i> Instagram
      </a>`;
  }

  document.getElementById('modalResumo').classList.add('active');
}

function fecharModal() {
  document.getElementById('modalResumo').classList.remove('active');
}

window.onclick = function(event) {
  const modal = document.getElementById('modalResumo');
  if (event.target === modal) {
    fecharModal();
  }
};

function aplicarFiltros() {
  const prof = document.getElementById('selectProfissao').value.toLowerCase();
  const cid = document.getElementById('selectCidade').value.toLowerCase();
  const esp = document.getElementById('selectEspecialidade').value.toLowerCase();
  const srv = document.getElementById('inputServicos').value.toLowerCase();

  const filtrados = listaCompleta.filter(p => {
    const matchProf = !prof || p.profissao.toLowerCase().includes(prof);
    const matchCid = !cid || p.cidade.toLowerCase().includes(cid);
    const matchEsp = !esp || p.especialidade.toLowerCase().includes(esp);
    const matchSrv = !srv || p.servicos.toLowerCase().includes(srv) || p.bio.toLowerCase().includes(srv);

    return matchProf && matchCid && matchEsp && matchSrv;
  });

  renderizarCards(filtrados);
}

function limparFiltros() {
  document.getElementById('selectProfissao').value = '';
  document.getElementById('selectCidade').value = '';
  document.getElementById('selectEspecialidade').value = '';
  document.getElementById('inputServicos').value = '';
  renderizarCards(listaCompleta);
}

window.onload = carregarDados;