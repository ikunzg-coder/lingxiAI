const API_TEXT = 'https://text.pollinations.ai';
const API_IMAGE = 'https://image.pollinations.ai/prompt';
const MODEL = 'openai';
const FALLBACK_MODELS = ['openai-fast', 'mistral', 'llama'];
const TIMEOUT_MS = 30000;

const welcome = document.getElementById('welcome');
const chat = document.getElementById('chat');
const input = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const status = document.getElementById('status');
const pageTitle = document.getElementById('pageTitle');
const welcomeTitle = document.getElementById('welcomeTitle');
const welcomeSub = document.getElementById('welcomeSub');
const chipsEl = document.getElementById('chips');
const modeBar = document.getElementById('modeBar');
const quickBtn = document.getElementById('quickBtn');
const quickText = document.getElementById('quickText');
const voiceBtn = document.getElementById('voiceBtn');
const loginBtn = document.getElementById('loginBtn');

let messages = [];
let currentMode = 'chat';
let isQuickMode = false;
let recognition = null;
let currentImage = null;
let currentSessionId = null;
let isRecording = false;
let currentUser = null;

const modes = {
  chat: {
    title: 'AI 对话',
    welcomeTitle: '有什么我能帮你的吗？',
    welcomeSub: '问任何问题，我会直接给你完整回答',
    placeholder: '发消息...',
    system: '你是灵犀 AI 助手。直接回答用户问题，不要输出任何内部推理或标签，只输出最终答案。',
    chips: [
      '帮我写一段 Python 爬虫代码',
      '解释一下量子计算的基本原理',
      '如何提高工作效率？',
      '推荐几本适合初学者的编程书',
      '用一句话总结道德经',
      '设计一个周末旅行计划'
    ]
  },
  image: {
    title: '图像生成',
    welcomeTitle: '想生成什么样的图片？',
    welcomeSub: '用文字描述画面，我会帮你生成图片',
    placeholder: '描述你想生成的图片...',
    system: '',
    chips: [
      '一只穿着宇航服的猫在月球上',
      '赛博朋克风格的城市夜景',
      '中国风山水画，水墨风格',
      '可爱的 Q 版小女孩吃冰淇淋',
      '未来科技感的人工智能机器人',
      '一片樱花树下的日式庭院'
    ]
  },
  ppt: {
    title: 'PPT 生成',
    welcomeTitle: '需要什么主题的 PPT？',
    welcomeSub: '输入主题，我会生成完整大纲并可下载',
    placeholder: '输入PPT主题...',
    system: '你是 PPT 制作专家。根据用户主题，生成一份结构清晰的 PPT 大纲，包含标题、目录、每页要点，使用 Markdown 格式。直接输出大纲，不要输出任何内部推理或标签。',
    chips: [
      '人工智能发展趋势',
      '大学生职业规划',
      '新能源汽车市场分析',
      '新产品发布会方案',
      '年度工作总结汇报',
      '健康饮食知识科普'
    ]
  },
  write: {
    title: '帮我写作',
    welcomeTitle: '需要写什么？',
    welcomeSub: '告诉我写作类型和要求，我来帮你完成',
    placeholder: '输入写作需求...',
    system: '你是专业写作助手。根据用户需求撰写内容。直接输出最终文章，不要输出任何内部推理或标签。',
    chips: [
      '写一封辞职信，语气委婉',
      '写一篇关于春天的散文',
      '帮我写一个小红书探店文案',
      '写一份产品需求文档模板',
      '生成 10 条朋友圈文案',
      '写一封给客户的道歉邮件'
    ]
  },
  translate: {
    title: '翻译',
    welcomeTitle: '需要翻译什么？',
    welcomeSub: '输入内容，我会自动检测并翻译',
    placeholder: '输入要翻译的内容...',
    system: '你是翻译助手。请把用户输入的内容翻译成自然流畅的中文或目标语言。只输出译文内容，不要输出任何内部推理或标签。',
    chips: [
      'Translate to English: 今天天气很好',
      '把这段话翻译成日语',
      '翻译成法语：我爱你',
      '英文翻译成中文：To be or not to be',
      '韩文翻译成中文：안녕하세요',
      '润色这段英文：I very like this book'
    ]
  },
  video: {
    title: '视频脚本',
    welcomeTitle: '想做什么视频？',
    welcomeSub: '输入视频主题，我帮你生成脚本和分镜',
    placeholder: '输入视频主题...',
    system: '你是短视频脚本创作专家。根据用户主题生成视频脚本，包含场景、旁白/台词、镜头提示。直接输出最终脚本，不要输出任何内部推理或标签。',
    chips: [
      '30 秒科技产品测评脚本',
      '1 分钟美食探店脚本',
      '知识科普类短视频脚本',
      'Vlog 开场脚本',
      '带货直播脚本',
      '励志类短视频脚本'
    ]
  }
};

function init() {
  setMode('chat');
  initVoice();
  initUser();
  initTheme();
  renderHistory();
}

function setMode(mode) {
  currentMode = mode;
  const cfg = modes[mode];

  pageTitle.textContent = cfg.title;
  welcomeTitle.textContent = cfg.welcomeTitle;
  welcomeSub.textContent = cfg.welcomeSub;
  input.placeholder = cfg.placeholder;

  renderChips(cfg.chips);
  updateModeBar();
  updateSidebarActive();

  messages = cfg.system ? [{ role: 'system', content: cfg.system }] : [];
}

function renderChips(list) {
  chipsEl.innerHTML = list.map(text =>
    `<div class="chip" onclick="sendChip('${escapeJsString(text)}')">${escapeHtml(text)}</div>`
  ).join('');
}

function updateModeBar() {
  document.querySelectorAll('.mode-tag').forEach(tag => {
    tag.classList.toggle('active', tag.dataset.mode === currentMode);
  });
}

function updateSidebarActive() {
  document.querySelectorAll('.nav-item').forEach((item, index) => {
    const modesList = ['chat', 'image', 'write', 'translate', 'ppt', 'video'];
    item.classList.toggle('active', modesList[index] === currentMode);
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJsString(text) {
  return text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\\/g, '\\\\');
}

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    toast('请选择图片文件');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    currentImage = e.target.result;
    updateImagePreview();
    sendBtn.disabled = !input.value.trim() && !currentImage;
    input.focus();
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  currentImage = null;
  document.getElementById('imgInput').value = '';
  updateImagePreview();
  sendBtn.disabled = !input.value.trim();
}

function updateImagePreview() {
  const preview = document.getElementById('imagePreview');
  const img = document.getElementById('previewImg');
  if (currentImage) {
    img.src = currentImage;
    preview.classList.add('show');
  } else {
    img.src = '';
    preview.classList.remove('show');
  }
}

function toast(text) {
  status.textContent = text;
  setTimeout(() => { if (status.textContent === text) status.textContent = ''; }, 2500);
}

function newChat() {
  setMode(currentMode);
  chat.innerHTML = '';
  chat.classList.remove('active');
  welcome.style.display = 'flex';
  input.value = '';
  sendBtn.disabled = true;
  status.textContent = '';
  currentImage = null;
  updateImagePreview();
  currentSessionId = null;
  renderHistory();
}

function getSessions() {
  try {
    return JSON.parse(localStorage.getItem('lingxi_sessions') || '[]');
  } catch (e) {
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem('lingxi_sessions', JSON.stringify(sessions));
}

function createSession(title = '新对话') {
  const session = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    title,
    mode: currentMode,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const sessions = getSessions();
  sessions.unshift(session);
  saveSessions(sessions);
  currentSessionId = session.id;
  renderHistory();
  return session;
}

function saveCurrentSession() {
  if (!currentSessionId) return;
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === currentSessionId);
  if (idx === -1) return;

  const firstUser = messages.find(m => m.role === 'user');
  sessions[idx].title = firstUser ? firstUser.content.slice(0, 30).replace(/\n/g, ' ') || '新对话' : '新对话';
  sessions[idx].mode = currentMode;
  sessions[idx].messages = messages;
  sessions[idx].updatedAt = Date.now();
  saveSessions(sessions);
  renderHistory();
}

function loadSession(id) {
  const sessions = getSessions();
  const session = sessions.find(s => s.id === id);
  if (!session) return;

  currentSessionId = session.id;
  currentMode = session.mode || 'chat';
  setMode(currentMode);
  messages = session.messages || [];
  renderMessages();
  renderHistory();
  input.value = '';
  sendBtn.disabled = true;
  status.textContent = '';
}

function deleteSession(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('确定删除这条历史记录？')) return;

  let sessions = getSessions();
  sessions = sessions.filter(s => s.id !== id);
  saveSessions(sessions);

  if (currentSessionId === id) {
    newChat();
  } else {
    renderHistory();
  }
}

function clearAllHistory() {
  if (!confirm('确定清空所有历史记录？此操作不可恢复。')) return;
  localStorage.removeItem('lingxi_sessions');
  newChat();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const sessions = getSessions();

  if (sessions.length === 0) {
    list.innerHTML = '<div class="history-empty">暂无历史记录</div>';
    return;
  }

  list.innerHTML = sessions.map(s => `
    <div class="history-item ${s.id === currentSessionId ? 'active' : ''}" onclick="loadSession('${s.id}')">
      <span class="history-title">${escapeHtml(s.title || '新对话')}</span>
      <button class="history-delete" onclick="deleteSession('${s.id}', event)" title="删除">&times;</button>
    </div>
  `).join('');
}

function renderMessages() {
  chat.innerHTML = '';
  if (messages.length === 0) {
    chat.classList.remove('active');
    welcome.style.display = 'flex';
    return;
  }

  welcome.style.display = 'none';
  chat.classList.add('active');

  messages.forEach(msg => {
    if (msg.role === 'user') {
      addMessage('user', msg.content, 'text', msg.image || null);
    } else if (msg.role === 'bot' || msg.role === 'assistant') {
      addMessage('bot', msg.content);
    }
  });

  chat.scrollTop = chat.scrollHeight;
}

function addMessage(role, content = '', type = 'text', imageUrl = null) {
  welcome.style.display = 'none';
  chat.classList.add('active');

  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `msg-avatar ${role}`;
  avatar.textContent = role === 'user' ? '我' : '';
  if (role === 'bot') {
    avatar.innerHTML = `<svg viewBox="0 0 100 100" width="22" height="22" fill="none">
      <defs>
        <linearGradient id="bot-avatar-grad" x1="50" y1="90" x2="50" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#00D9FF"/>
          <stop offset="100%" stop-color="#A855F7"/>
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="84" height="84" rx="24" fill="#F0F7FF"/>
      <path d="M28 76 C28 50 32 28 44 28 C56 28 54 44 44 52 C36 58 36 70 50 70 C62 70 62 58 54 52 C44 44 44 28 56 28 C68 28 72 50 72 76" stroke="url(#bot-avatar-grad)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M26 76 L74 76" stroke="url(#bot-avatar-grad)" stroke-width="7" stroke-linecap="round"/>
    </svg>`;
  }

  const contentWrap = document.createElement('div');
  contentWrap.className = 'msg-content';

  const bubble = document.createElement('div');
  bubble.className = `msg-bubble ${role}`;

  if (type === 'image') {
    const img = document.createElement('img');
    img.src = content;
    img.alt = '生成的图片';
    bubble.appendChild(img);
  } else {
    if (content) {
      const textNode = document.createElement('div');
      textNode.textContent = content;
      bubble.appendChild(textNode);
    }
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = '图片';
      bubble.appendChild(img);
    }
  }

  contentWrap.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(contentWrap);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;

  return { row, bubble, contentWrap };
}

function addThinkBox(targetRow, text = '') {
  const contentWrap = targetRow.querySelector('.msg-content');
  const thinkBox = document.createElement('div');
  thinkBox.className = 'think-box';

  thinkBox.innerHTML = `
    <div class="think-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <span class="think-header-left">
        <svg class="think-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v0a3 3 0 0 0-3 3v1a3 3 0 0 0 .5 1.7A3 3 0 0 0 6 14v0a3 3 0 0 0 1 2.3V18a3 3 0 0 0 3 3 3 3 0 0 0 2 1 3 3 0 0 0 2-1 3 3 0 0 0 3-3v-1.7A3 3 0 0 0 18 14a3 3 0 0 0-.5-3.3A3 3 0 0 0 18 9V8a3 3 0 0 0-3-3v0a3 3 0 0 0-3-3z"></path>
          <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 17h4"></path>
        </svg>
        <span>思考过程</span>
      </span>
      <svg class="think-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg>
    </div>
    <div class="think-body ${text ? '' : 'thinking'}">${text || '正在思考...'}</div>
  `;

  contentWrap.insertBefore(thinkBox, contentWrap.firstChild);
  return thinkBox.querySelector('.think-body');
}

function addThinkingIndicator() {
  welcome.style.display = 'none';
  chat.classList.add('active');

  const row = document.createElement('div');
  row.className = 'message-row bot thinking-row';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar bot';
  avatar.innerHTML = `<svg viewBox="0 0 100 100" width="22" height="22" fill="none">
    <defs>
      <linearGradient id="bot-avatar-grad-thinking" x1="50" y1="90" x2="50" y2="10" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#00D9FF"/>
        <stop offset="100%" stop-color="#A855F7"/>
      </linearGradient>
    </defs>
    <rect x="8" y="8" width="84" height="84" rx="24" fill="#F0F7FF"/>
    <path d="M28 76 C28 50 32 28 44 28 C56 28 54 44 44 52 C36 58 36 70 50 70 C62 70 62 58 54 52 C44 44 44 28 56 28 C68 28 72 50 72 76" stroke="url(#bot-avatar-grad-thinking)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M26 76 L74 76" stroke="url(#bot-avatar-grad-thinking)" stroke-width="7" stroke-linecap="round"/>
  </svg>`;

  const contentWrap = document.createElement('div');
  contentWrap.className = 'msg-content';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble bot thinking-bubble';
  bubble.innerHTML = `
    <span class="thinking-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path>
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"></path>
      </svg>
    </span>
    <span>灵犀正在思考</span>
    <span class="thinking-dots"><span></span><span></span><span></span></span>
  `;

  contentWrap.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(contentWrap);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;

  return { row, bubble, contentWrap };
}

function setLoading(loading) {
  input.disabled = loading;
  sendBtn.disabled = loading || (!input.value.trim() && !currentImage);
  status.textContent = loading ? '灵犀正在思考...' : '';
  if (!loading) input.focus();
}

function buildPrompt() {
  let system = '';
  const parts = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      system = msg.content;
    } else if (msg.role === 'user') {
      parts.push(`User: ${msg.content}`);
    } else {
      parts.push(`Assistant: ${msg.content}`);
    }
  }
  return { system, prompt: parts.join('\n\n') };
}

function parseThinkAnswer(text) {
  if (!text) return { think: '', answer: '' };

  let cleaned = text.trim();

  // 如果整段就是 JSON，尝试解析
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const obj = JSON.parse(cleaned);
      const content = obj.content || obj.answer || obj.message || obj.text || obj.response;
      if (content) return { think: '', answer: String(content) };
    } catch (e) {}
  }

  // 去掉行首的 {"role":"assistant"...} 这类元数据
  cleaned = cleaned.replace(/^\s*\{\s*"role"\s*:\s*"[^"]+"\s*,?\s*/i, '');
  cleaned = cleaned.replace(/^\s*"role"\s*:\s*"[^"]+"\s*,?\s*/i, '');
  cleaned = cleaned.replace(/^\s*"reasoning"\s*:\s*"[^"]*(?:\\.[^"\\]*)*"\s*,?\s*/is, '');

  // 尝试从 <answer> 标签中提取
  const answerMatch = cleaned.match(/<answer>([\s\S]*?)<\/answer>/i);
  if (answerMatch) {
    return { think: '', answer: answerMatch[1].trim() };
  }

  // 尝试从 <think> 标签中提取（但要忽略）
  const thinkMatch = cleaned.match(/<think>([\s\S]*?)<\/think>/i);
  let think = thinkMatch ? thinkMatch[1].trim() : '';

  // 去掉残留的 <think> 和 <answer> 开头
  let answer = cleaned
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?answer>/gi, '')
    .replace(/^\s*\{[\s\S]*?\}\s*/g, '') // 再次清理残留 JSON
    .trim();

  if (!answer) answer = think || cleaned;
  if (!think) think = '';

  return { think, answer };
}

input.addEventListener('input', () => {
  sendBtn.disabled = !input.value.trim() && !currentImage;
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    newChat();
  }
});

function sendChip(text) {
  input.value = text;
  sendMessage();
}

window.sendChip = sendChip;
window.newChat = newChat;
window.setMode = setMode;
window.toggleQuick = toggleQuick;
window.toggleVoice = toggleVoice;
window.showMore = showMore;
window.downloadChat = downloadChat;
window.handleImageSelect = handleImageSelect;
window.clearImage = clearImage;
window.loadSession = loadSession;
window.deleteSession = deleteSession;
window.clearAllHistory = clearAllHistory;

async function sendMessage() {
  const text = input.value.trim();
  if (!text && !currentImage) return;

  if (!currentSessionId) {
    createSession(text || '新对话');
  }

  input.value = '';
  sendBtn.disabled = true;
  const imageUrl = currentImage;
  currentImage = null;
  updateImagePreview();

  addMessage('user', text, 'text', imageUrl);
  messages.push({ role: 'user', content: text || '[图片]', image: imageUrl || undefined });
  saveCurrentSession();
  setLoading(true);

  if (currentMode === 'image') {
    await generateImage(text);
    saveCurrentSession();
    setLoading(false);
    return;
  }

  const thinkingRow = addThinkingIndicator();

  const { system, prompt } = buildPrompt();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const tryModels = [MODEL, ...FALLBACK_MODELS.filter(m => m !== MODEL)];
  let lastError = null;
  let rawReply = null;

  try {
    for (const modelName of tryModels) {
      try {
        const params = new URLSearchParams({
          model: modelName,
          system: system,
          temperature: isQuickMode ? '0.3' : '0.7'
        });
        const url = `${API_TEXT}/${encodeURIComponent(prompt)}?${params.toString()}`;

        const res = await fetch(url, { signal: controller.signal });

        if (res.ok) {
          rawReply = await res.text();
          break;
        }

        lastError = `HTTP ${res.status}`;
        if (res.status !== 429) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        console.warn(`模型 ${modelName} 限流 (429)，尝试下一个...`);
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        if (err.message && err.message.startsWith('HTTP') && !err.message.includes('429')) throw err;
        lastError = err.message;
        console.warn(`模型 ${modelName} 错误: ${err.message}`);
      }
    }
    clearTimeout(timer);

    if (!rawReply) {
      throw new Error(lastError || '所有模型都不可用');
    }

    if (!rawReply.trim()) {
      throw new Error('返回内容为空');
    }

    thinkingRow.row.remove();

    const { think, answer } = parseThinkAnswer(rawReply);
    const botRow = addMessage('bot', answer);

    messages.push({ role: 'assistant', content: answer });

    if (currentMode === 'ppt') {
      addActionButton(botRow.contentWrap, '下载 PPT 大纲', () => downloadFile(answer, `PPT大纲_${Date.now()}.md`));
    }
  } catch (err) {
    clearTimeout(timer);
    thinkingRow.row.remove();
    let msg = err.message;
    if (err.name === 'AbortError') {
      msg = '请求超时（30秒），免费接口可能较慢或当前排队较多，请稍后再试';
    } else if (msg.includes('429')) {
      msg = '当前使用人数过多，备用模型都已限流，请等待 15~30 秒后再试';
    }
    addMessage('bot', '请求失败：' + msg);
    console.error(err);
  } finally {
    setLoading(false);
  }
}

window.sendMessage = sendMessage;

async function generateImage(prompt) {
  const botRow = addMessage('bot', '', 'image');
  status.textContent = '正在生成图片...';

  const width = 1024;
  const height = 1024;
  const seed = Math.floor(Math.random() * 1000000);
  const url = `${API_IMAGE}/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();
    const imageUrl = URL.createObjectURL(blob);

    botRow.bubble.innerHTML = '';
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    botRow.bubble.appendChild(img);

    addActionButton(botRow.contentWrap, '下载图片', () => {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = `灵犀生成_${Date.now()}.png`;
      a.click();
    });

    messages.push({ role: 'assistant', content: `[图片] ${prompt}` });
  } catch (err) {
    botRow.bubble.textContent = '图片生成失败：' + err.message;
  }
}

function addActionButton(container, label, onClick) {
  const existing = container.querySelector('.ppt-actions, .doc-actions');
  if (existing) return;

  const actions = document.createElement('div');
  actions.className = currentMode === 'ppt' ? 'ppt-actions' : 'doc-actions';

  const btn = document.createElement('button');
  btn.className = 'action-btn';
  btn.textContent = label;
  btn.onclick = onClick;

  actions.appendChild(btn);
  container.appendChild(actions);
  chat.scrollTop = chat.scrollHeight;
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast('已下载：' + filename);
}

function downloadChat() {
  if (!chat.children.length) {
    toast('还没有对话内容');
    return;
  }

  let content = '# 灵犀 AI 对话记录\n\n';
  messages.forEach(msg => {
    if (msg.role !== 'system') {
      content += `**${msg.role === 'user' ? '我' : 'AI'}**：${msg.content}\n\n`;
    }
  });

  downloadFile(content, `灵犀对话_${Date.now()}.md`);
}

function toggleQuick() {
  isQuickMode = !isQuickMode;
  quickBtn.classList.toggle('active', isQuickMode);
  quickText.textContent = isQuickMode ? '快速 ✓' : '快速';
  toast(isQuickMode ? '已开启快速模式' : '已关闭快速模式');
}

function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    input.value = (input.value + ' ' + text).trim();
    sendBtn.disabled = !input.value.trim();
    stopRecording();
  };

  recognition.onerror = () => {
    toast('语音识别失败，请重试');
    stopRecording();
  };

  recognition.onend = () => {
    stopRecording();
  };
}

function toggleVoice() {
  if (!recognition) {
    toast('当前浏览器不支持语音输入');
    return;
  }

  if (isRecording) {
    recognition.stop();
  } else {
    recognition.start();
    isRecording = true;
    voiceBtn.classList.add('recording');
    toast('正在听，请说话...');
  }
}

function stopRecording() {
  isRecording = false;
  voiceBtn.classList.remove('recording');
}

function showMore() {
  const existing = document.querySelector('.more-menu');
  if (existing) {
    existing.remove();
    return;
  }

  const menu = document.createElement('div');
  menu.className = 'more-menu show';
  menu.innerHTML = `
    <div class="more-menu-item" onclick="toggleThinking(); this.parentElement.remove()">${isThinkingEnabled ? '关闭' : '开启'}思考过程</div>
    <div class="more-menu-item" onclick="downloadChat(); this.parentElement.remove()">导出对话</div>
    <div class="more-menu-item" onclick="newChat(); this.parentElement.remove()">清空对话</div>
    ${currentUser ? `<div class="more-menu-item" onclick="logout(); this.parentElement.remove()">退出登录</div>` : ''}
  `;

  document.querySelector('.input-area').appendChild(menu);

  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    });
  }, 10);
}

function toggleThinking() {
  isThinkingEnabled = !isThinkingEnabled;
  toast(isThinkingEnabled ? '已开启思考过程展示' : '已关闭思考过程展示');
}

window.toggleThinking = toggleThinking;

/* 登录与关于 */
let authMode = 'login';

function openLogin() {
  if (currentUser) {
    if (confirm(`当前登录用户：${currentUser.name}\n是否退出登录？`)) {
      logout();
    }
    return;
  }
  switchAuth('login');
  document.getElementById('loginModal').classList.add('show');
  setTimeout(() => document.getElementById('authName').focus(), 100);
}

function openAbout() {
  document.getElementById('aboutModal').classList.add('show');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

function closeModalOnBackdrop(event, id) {
  if (event.target.id === id) {
    closeModal(id);
  }
}

function switchAuth(mode) {
  authMode = mode;
  const isLogin = mode === 'login';

  document.getElementById('authTitle').textContent = isLogin ? '登录灵犀 AI' : '注册灵犀 AI';
  document.getElementById('authDesc').textContent = isLogin ? '请输入账号和密码登录。' : '注册新账号，账号和密码仅保存在本地。';
  document.getElementById('authSubmitBtn').textContent = isLogin ? '登录' : '注册';
  document.getElementById('authPassword2').style.display = isLogin ? 'none' : 'block';

  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
}

function submitAuth() {
  if (authMode === 'login') {
    doLogin();
  } else {
    doRegister();
  }
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem('lingxi_users') || '{}');
  } catch (e) {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem('lingxi_users', JSON.stringify(users));
}

function doLogin() {
  const name = document.getElementById('authName').value.trim();
  const password = document.getElementById('authPassword').value;

  if (!name || !password) {
    toast('请输入账号和密码');
    return;
  }

  const users = getUsers();
  const user = users[name];

  if (!user) {
    toast('账号不存在，请先注册');
    return;
  }

  if (user.password !== password) {
    toast('密码错误');
    return;
  }

  currentUser = { name };
  localStorage.setItem('lingxi_user', JSON.stringify(currentUser));
  renderUser();
  closeModal('loginModal');
  clearAuthForm();
  toast('登录成功，欢迎 ' + name);
}

function doRegister() {
  const name = document.getElementById('authName').value.trim();
  const password = document.getElementById('authPassword').value;
  const password2 = document.getElementById('authPassword2').value;

  if (!name || !password || !password2) {
    toast('请填写所有字段');
    return;
  }

  if (name.length < 2) {
    toast('账号至少 2 个字符');
    return;
  }

  if (password.length < 4) {
    toast('密码至少 4 位');
    return;
  }

  if (password !== password2) {
    toast('两次输入的密码不一致');
    return;
  }

  const users = getUsers();
  if (users[name]) {
    toast('该账号已存在，请直接登录');
    return;
  }

  users[name] = { password, createdAt: Date.now() };
  saveUsers(users);

  currentUser = { name };
  localStorage.setItem('lingxi_user', JSON.stringify(currentUser));
  renderUser();
  closeModal('loginModal');
  clearAuthForm();
  toast('注册成功，已自动登录');
}

function clearAuthForm() {
  document.getElementById('authName').value = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('authPassword2').value = '';
}

function logout() {
  currentUser = null;
  localStorage.removeItem('lingxi_user');
  renderUser();
  toast('已退出登录');
}

function initUser() {
  const saved = localStorage.getItem('lingxi_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
    } catch (e) {
      currentUser = null;
    }
  }
  renderUser();
}

let isDark = true;

function initTheme() {
  const saved = localStorage.getItem('lingxi_theme');
  isDark = saved ? saved === 'dark' : true;
  applyTheme();
}

function toggleTheme() {
  isDark = !isDark;
  applyTheme();
  localStorage.setItem('lingxi_theme', isDark ? 'dark' : 'light');
}

function applyTheme() {
  document.body.classList.toggle('dark', isDark);
  const icon = isDark
    ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'
    : '<circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>';
  document.querySelector('#themeBtn svg').innerHTML = icon;
}

function renderUser() {
  if (!currentUser) {
    loginBtn.className = 'btn-login';
    loginBtn.innerHTML = '登录';
    loginBtn.onclick = openLogin;
    return;
  }

  const initial = currentUser.name.charAt(0).toUpperCase();
  loginBtn.className = 'user-profile';
  loginBtn.innerHTML = `
    <div class="user-avatar">${initial}</div>
    <span class="user-name">${escapeHtml(currentUser.name)}</span>
  `;
  loginBtn.onclick = openLogin;
}

window.openLogin = openLogin;
window.openAbout = openAbout;
window.closeModal = closeModal;
window.closeModalOnBackdrop = closeModalOnBackdrop;
window.switchAuth = switchAuth;
window.submitAuth = submitAuth;
window.doLogin = doLogin;
window.doRegister = doRegister;
window.logout = logout;
window.toggleTheme = toggleTheme;

document.getElementById('authPassword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitAuth();
});

document.getElementById('authPassword2').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitAuth();
});

init();
