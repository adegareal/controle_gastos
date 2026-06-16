# 💰 Controle Financeiro

App de controle financeiro familiar com Firebase + React + Vite.

---

## 🚀 Como rodar localmente

### 1. Clone o repositório
```bash
git clone https://github.com/SEU_USUARIO/controle-gastos.git
cd controle-gastos
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
```bash
cp .env.example .env
```
Abra o `.env` e cole suas credenciais do Firebase (veja o Passo 4 abaixo).

### 4. Inicie o servidor de desenvolvimento
```bash
npm run dev
```
Acesse **http://localhost:5173**

---

## 🔥 Configurar o Firebase

### Passo 1 — Criar projeto
1. Acesse **https://console.firebase.google.com**
2. Clique em **"Adicionar projeto"** → nome: `controle-gastos`
3. Pode desativar o Google Analytics → **"Criar projeto"**

### Passo 2 — Ativar Authentication
1. Menu lateral: **Build → Authentication → "Vamos começar"**
2. Clique em **E-mail/senha** → ative → **Salvar**

### Passo 3 — Ativar Firestore
1. Menu lateral: **Build → Firestore Database → "Criar banco de dados"**
2. Modo: **produção** → região: `southamerica-east1` (São Paulo)
3. Vá em **Regras** e cole:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
4. Clique em **Publicar**

### Passo 4 — Obter credenciais
1. ⚙️ Configurações do projeto → **"Seus apps"** → clique em **`</>`**
2. Registre o app web → copie o `firebaseConfig`
3. Cole os valores no seu arquivo **`.env`**:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## ☁️ Publicar no Vercel

### Opção A — Via GitHub (recomendado)
1. Suba o projeto para o GitHub
2. Acesse **vercel.com** → login com GitHub
3. Clique em **"Add New Project"** → selecione o repositório
4. Em **"Environment Variables"**, adicione cada variável do `.env`
5. Clique em **"Deploy"** ✅

### Opção B — Via CLI
```bash
npm install -g vercel
vercel
```
Quando pedir as variáveis de ambiente, adicione uma por uma.

---

## 🔐 Variáveis de ambiente no Vercel

No painel do Vercel → seu projeto → **Settings → Environment Variables**:

| Nome | Valor |
|------|-------|
| `VITE_FIREBASE_API_KEY` | sua api key |
| `VITE_FIREBASE_AUTH_DOMAIN` | seu-projeto.firebaseapp.com |
| `VITE_FIREBASE_PROJECT_ID` | seu-projeto |
| `VITE_FIREBASE_STORAGE_BUCKET` | seu-projeto.appspot.com |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | seu sender id |
| `VITE_FIREBASE_APP_ID` | seu app id |

Após adicionar, clique em **"Redeploy"**.

---

## 📁 Estrutura do projeto

```
controle-gastos/
├── src/
│   ├── App.jsx        ← Aplicativo principal
│   ├── firebase.js    ← Configuração do Firebase (usa .env)
│   └── main.jsx       ← Entrada do React
├── .env.example       ← Modelo das variáveis (seguro para o GitHub)
├── .env               ← ⚠️ SUAS credenciais (NÃO suba para o GitHub)
├── .gitignore         ← Protege o .env automaticamente
├── index.html
├── package.json
└── vite.config.js
```

---

## 📲 Compartilhar com a família

Após publicar, envie o link do Vercel pelo WhatsApp.
Cada membro cria sua própria conta com e-mail e senha.
Os dados ficam sincronizados em tempo real na nuvem! ☁️
