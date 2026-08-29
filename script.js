const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQRSLkWdYOqO25SuyaGCdvfxKvoPXMRsWs9WBQ22Q_G64-DnHWdyWKEUbkbm8LirCKb0yZRT_Le-j5Q/pub?gid=1879601222&single=true&output=csv';

// Proxy alternativo para evitar bloqueio de CORS no GitHub Pages
const PROXY_URL = 'https://api.allorigins.win/raw?url=';

let listaCompleta = [];

function atualizarDataESaudacao() {
  const agora = new Date();
  const opcoesData = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' };
  const dataFormatada = agora.toLocaleDateString('pt-BR', opcoesData);
  const elData = document.getElementById('textoData');
  if (elData) elData.innerText = dataFormatada;

  const horaStr = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });
  const hora = parseInt(horaStr, 10);

  let saudacao = 'Boa noite!';
  if (hora >= 5 && hora < 12) saudacao = 'Bom dia!';
  else if (hora >= 12 && hora < 18) saudacao = 'Boa tarde!';

  const elSaudacao = document.getElementById('textoSaudacao');
  if (elSaudacao) elSaudacao.innerText = saudacao;
}

function padronizarTexto(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .trim()
    .toLowerCase()
    .replace(/(^|\s)([a-zá-úà-üç])/gi, (match, espaco, letra) => espaco + letra.toUpperCase());
}

function formatarUrlDrive(url) {
  if (!url) return '';
  const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

function parseCSVLine(textLine) {
  let arr = [''], i = 0, inQuotes = false;
  for (let ch of textLine) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      arr.push('');
      i++;
    } else {
      arr[i] += ch;
    }
  }
  return arr.map(c => c.replace(/^"|"$/g, '').trim());
}

function parseCSV(text) {
  const rawLines = text.split(/\r?\n/);
  const lines = [];
  let buffer = '';

  for (let line of rawLines) {
    buffer += (buffer ? '\n' : '') + line;
    const quoteCount = (buffer.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
      lines.push(buffer);
      buffer = '';
    }
  }

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  
  const getIndex = (keys, defaultIdx) => {
    const idx = headers.findIndex(h => keys.some(k => h.includes(k)));
    return idx !== -1 ? idx : defaultIdx;
  };

  const idxSituacao = getIndex(['situacao', 'situação'], 18);
  const idxNome = getIndex(['nome'], 1);
  const idxCidade = getIndex(['cidade'], 2);
  const idxEspecializacoes = getIndex(['especialização', 'especializacoes', 'especialidade'], 3);
  const idxProfissao = 17; // Coluna R
  
  const idxServicos = getIndex(['serviço', 'servico', 'atendimento'], 4);
  const idxRegistro = getIndex(['registro'], 5);
  const idxBio = getIndex(['bio', 'resumo'], 6);
  const idxPublico = getIndex(['público', 'publico'], 7);
  const idxModalidade = getIndex(['modalidade'], 8);
  const idxWhatsapp = getIndex(['whatsapp', 'telefone', 'celular'], 9);
  const idxEmail = getIndex(['email', 'e-mail'], 10);
  const idxInstagram = getIndex(['instagram'], 11);

  const result = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]);

    if (cols.length >= 2 && cols[idxNome] !== '') {
      const situacao = (cols[idxSituacao] || '').toUpperCase();
      
      if (situacao !== 'ON') {
        continue;
      }

      let fotoUrl = '';
      cols.forEach(c => {
        if (c.includes('drive.google.com')) fotoUrl = c;
      });

      let periodosList = [];
      cols.forEach((col, idx) => {
        if (idx > 11 && idx < idxSituacao && col && col.toUpperCase() !== 'N/A' && !col.includes('drive.google.com')) {
          periodosList.push(col);
        }
      });

      const profissaoBruta = cols[idxProfissao] || cols[3] || 'Profissional da Saúde';

      result.push({
        nome: cols[idxNome] || '',
        cidade: cols[idxCidade] || '',
        profissao: padronizarTexto(profissaoBruta),
        especialidade: cols[idxEspecializacoes] || '',
        servicos: cols[idxServicos] || '',
        registro: cols[idxRegistro] || '',
        bio: cols[idxBio] || '',
        publico: cols[idxPublico] || '',
        modalidade: cols[idxModalidade] || '',
        whatsapp: cols[idxWhatsapp] ? cols[idxWhatsapp].replace(/\D/g, '') : '',
        email: cols[idxEmail] || '',
        instagram: cols[idxInstagram] ? cols[idxInstagram].replace('@', '') : '',
        periodos: periodosList.length > 0 ? periodosList.slice(0, 2).join(' | ') : 'Não informado',
        foto: formatarUrlDrive(fotoUrl)
      });
    }
  }
  return result;
}

async function carregarDados() {
  atualizarDataESaudacao();
  const grid = document.getElementById('gridProfissionais');

  try {
    const timestamp = new Date().getTime();
    let response;

    // Tenta primeiro o acesso direto
    try {
      response = await fetch(`${CSV_URL}&nocache=${timestamp}`);
      if (!response.ok) throw new Error('Acesso direto bloqueado');
    } catch (errDirect) {
      // Se falhar no GitHub Pages devido ao CORS, usa o Proxy
      console.warn('Requisição direta falhou ou foi bloqueada por CORS. Tentando via Proxy...');
      response = await fetch(`${PROXY_URL}${encodeURIComponent(CSV_URL)}`);
    }

    if (!response || !response.ok) {
      throw new Error('Falha ao obter os dados da planilha.');
    }

    const data = await response.text();
    listaCompleta = parseCSV(data);
    
    preencherFiltros();
    renderizarCards(listaCompleta);

  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    if (grid) {
      grid.innerHTML = `
        <div style="color: #e11d48; padding: 20px; text-align: center; width: 100%; font-weight: 600;">
          Não foi possível carregar a lista de profissionais. Verifique o compartilhamento da planilha no Google Drive.
        </div>`;
    }
  }
}

function preencherFiltros() {
  const selectProf = document.getElementById('selectProfissao');
  const selectCid = document.getElementById('selectCidade');

  if (selectProf) selectProf.innerHTML = '<option value="">Todas as Profissões</option>';
  if (selectCid) selectCid.innerHTML = '<option value="">Todas as Cidades</option>';

  const profissoes = new Set();
  const cidades = new Set();

  listaCompleta.forEach(p => {
    if (p.profissao) profissoes.add(p.profissao);
    if (p.cidade) cidades.add(padronizarTexto(p.cidade));
  });

  if (selectProf) {
    Array.from(profissoes).sort().forEach(prof => {
      selectProf.innerHTML += `<option value="${prof}">${prof}</option>`;
    });
  }

  if (selectCid) {
    Array.from(cidades).sort().forEach(cid => {
      selectCid.innerHTML += `<option value="${cid}">${cid}</option>`;
    });
  }
}

function renderizarCards(profissionais) {
  const grid = document.getElementById('gridProfissionais');
  const contador = document.getElementById('contadorResultados');
  if (!grid) return;

  grid.innerHTML = '';
  if (contador) contador.innerText = `Profissionais encontrados (${profissionais.length})`;

  if (profissionais.length === 0) {
    grid.innerHTML = `
      <div style="color: var(--text-muted); padding: 20px; text-align: center; width: 100%;">
        Nenhum profissional encontrado.
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
    const especialidadeExibida = padronizarTexto(p.especialidade);

    card.innerHTML = `
      <i class="fa-regular fa-heart prof-fav"></i>
      <div class="prof-avatar">${avatarHTML}</div>
      <div class="prof-body">
        <div class="prof-name" title="${p.nome}">${p.nome}</div>
        <div class="prof-profession">${p.profissao}</div>
        ${especialidadeExibida ? `<div class="prof-spec">${especialidadeExibida}</div>` : ''}
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

function abrirModal(p) {
  document.getElementById('modalNome').innerText = p.nome || 'Sem nome';
  document.getElementById('modalRegistro').innerText = p.registro ? `Reg: ${p.registro}` : 'Sem registro';
  document.getElementById('modalBio').innerText = p.bio || '-';
  document.getElementById('modalEspecialidades').innerText = padronizarTexto(p.especialidade) || '-';
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
  if (event.target === modal) fecharModal();
};

function aplicarFiltros() {
  const prof = (document.getElementById('selectProfissao')?.value || '').trim().toLowerCase();
  const cid = (document.getElementById('selectCidade')?.value || '').trim().toLowerCase();
  
  const elEsp = document.getElementById('inputEspecialidade');
  const esp = (elEsp?.value || '').trim().toLowerCase();

  const elSrv = document.getElementById('inputServicos');
  const srv = (elSrv?.value || '').trim().toLowerCase();

  const filtrados = listaCompleta.filter(p => {
    const matchProf = !prof || p.profissao.toLowerCase() === prof;
    const matchCid = !cid || p.cidade.toLowerCase().includes(cid);
    const matchEsp = !esp || p.especialidade.toLowerCase().includes(esp);
    const matchSrv = !srv || p.servicos.toLowerCase().includes(srv) || p.bio.toLowerCase().includes(srv);

    return matchProf && matchCid && matchEsp && matchSrv;
  });

  renderizarCards(filtrados);
}

function limparFiltros() {
  if (document.getElementById('selectProfissao')) document.getElementById('selectProfissao').value = '';
  if (document.getElementById('selectCidade')) document.getElementById('selectCidade').value = '';
  if (document.getElementById('inputEspecialidade')) document.getElementById('inputEspecialidade').value = '';
  if (document.getElementById('inputServicos')) document.getElementById('inputServicos').value = '';
  renderizarCards(listaCompleta);
}

function scrollCarrossel(deslocamento) {
  const slider = document.getElementById('sliderContainer');
  if (slider) {
    slider.scrollBy({ left: deslocamento, behavior: 'smooth' });
  }
}

window.onload = carregarDados;
