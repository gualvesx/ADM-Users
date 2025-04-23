const express = require("express");
const path = require("path");
const mysql = require("mysql2");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "mvc/views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const db = mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "localhost"
});

db.connect((err) => {
    if (err) {
        console.error("Erro ao conectar ao banco de dados: ", err);
        return;
    }
    console.log("Conectado ao banco de dados MySQL");
});

// Rotas básicas
app.get("/", (req, res) => {
    res.render("index", {
        nome: "sidney",
        texto: "Demonstração"
    });
});

app.get('/home', (req, res) => {
    // Verifique se o usuário está logado
    if (!req.session.usuario) {
        return res.redirect('/');
    }
    
    // Renderize a página home com os dados do usuário
    res.render('home', { 
        usuario: req.session.usuario,
        mensagem: ''
    });
});

app.get("/cadastro", (req, res) => {
    res.render("cadastro", { mensagem: "Bem-vindo à página de cadastro!" });
});

// Rota de login modificada
app.post("/login", (req, res) => {
    const { email, senha } = req.body;
    
    if (!email || !senha) {
        return res.render("error", { mensagem: "Preencha todos os campos" });
    }
    
    const query = "SELECT * FROM usuarios WHERE email = ?";
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error("Erro na consulta: ", err);
            return res.render("error", { mensagem: "Erro no servidor" });
        }
        
        if (results.length > 0) {
            const usuario = results[0];
            if (senha === usuario.senha) {
                // Formata os dados para exibição
                const userData = {
                    id: usuario.id_usuarios,
                    nome: usuario.nome,
                    email: usuario.email,
                    grupo: usuario.grupo_u,
                    criado_em: new Date(usuario.criado_em).toLocaleDateString('pt-BR')
                };
                
                res.render("home", { 
                    usuario: userData,
                    mensagem: "Login bem-sucedido!"
                });
            } else {
                res.render("error", { mensagem: "Senha incorreta" });
            }
        } else {
            res.render("error", { mensagem: "Email não encontrado" });
        }
    });
});

// Rota de cadastro modificada
app.post("/cadastrar", (req, res) => {
    const { nome, email, senha, grupo_u } = req.body;

    if (!nome || !email || !senha || !grupo_u) {
        return res.render("error", { mensagem: "Preencha todos os campos" });
    }

    // Verifica se o grupo é válido
    if (!['ADM', 'USER'].includes(grupo_u)) {
        return res.render("error", { mensagem: "Grupo inválido. Use ADM ou USER" });
    }

    db.query("SELECT email FROM usuarios WHERE email = ?", [email], (err, results) => {
        if (err) {
            console.error("Erro ao verificar email:", err);
            return res.render("error", { mensagem: "Erro no servidor" });
        }
        
        if (results.length > 0) {
            return res.render("error", { mensagem: "Email já cadastrado" });
        }

        db.query(
            "INSERT INTO usuarios (nome, email, senha, grupo_u) VALUES (?, ?, ?, ?)",
            [nome, email, senha, grupo_u],
            (err) => {
                if (err) {
                    console.error("Erro ao cadastrar usuário:", err);
                    return res.render("error", { mensagem: "Erro no servidor" });
                }
                res.redirect("/");
            }
        );
    });
});

// Adicione esta rota para exibir o formulário de edição
app.get("/editar-usuario/:id", (req, res) => {
    const userId = req.params.id;
    
    db.query("SELECT * FROM usuarios WHERE id_usuarios = ?", [userId], (err, results) => {
        if (err || results.length === 0) {
            console.error("Erro ao buscar usuário:", err);
            return res.render("error", { mensagem: "Usuário não encontrado" });
        }
        
        const usuario = results[0];
        usuario.criado_em = new Date(usuario.criado_em).toLocaleDateString('pt-BR');
        
        res.render("editar-usuario", { 
            usuario: usuario,
            mensagem: ""
        });
    });
});

// Rota para processar a edição
app.post("/atualizar-usuario", (req, res) => {
    const { id, nome, email, senha, grupo_u } = req.body;
    
    if (!id || !nome || !email || !grupo_u) {
        return res.render("error", { mensagem: "Preencha todos os campos obrigatórios" });
    }
    
    // Verifica se o email já existe para outro usuário
    db.query("SELECT id_usuarios FROM usuarios WHERE email = ? AND id_usuarios != ?", 
    [email, id], (err, results) => {
        if (err) {
            console.error("Erro ao verificar email:", err);
            return res.render("error", { mensagem: "Erro no servidor" });
        }
        
        if (results.length > 0) {
            return res.render("error", { mensagem: "Email já está em uso por outro usuário" });
        }
        
        // Atualiza com ou sem senha
        let query, params;
        if (senha) {
            query = "UPDATE usuarios SET nome = ?, email = ?, senha = ?, grupo_u = ? WHERE id_usuarios = ?";
            params = [nome, email, senha, grupo_u, id];
        } else {
            query = "UPDATE usuarios SET nome = ?, email = ?, grupo_u = ? WHERE id_usuarios = ?";
            params = [nome, email, grupo_u, id];
        }
        
        db.query(query, params, (err) => {
            if (err) {
                console.error("Erro ao atualizar usuário:", err);
                return res.render("error", { mensagem: "Erro ao atualizar usuário" });
            }
            
            // Redireciona de volta para a página de perfil
            res.redirect(`/editar-usuario/${id}?success=1`);
        });
    });
});

// Rota para listar todos os usuários
app.get('/admin/usuarios', (req, res) => {
    db.query('SELECT * FROM usuarios ORDER BY criado_em DESC', (err, results) => {
        if (err) {
            console.error('Erro ao buscar usuários:', err);
            return res.render('error', { mensagem: 'Erro ao carregar usuários' });
        }
        
        // Formata a data para exibição
        const usuarios = results.map(user => ({
            ...user,
            criado_em: new Date(user.criado_em).toLocaleDateString('pt-BR')
        }));
        
        res.render('admin/usuarios', { 
            usuarios,
            mensagem: req.query.success ? 'Usuário atualizado com sucesso!' : ''
        });
    });
});

// Rota para editar usuário (mantém a mesma do exemplo anterior)
app.get('/admin/usuarios/editar/:id', (req, res) => {
    const userId = req.params.id;
    
    db.query('SELECT * FROM usuarios WHERE id_usuarios = ?', [userId], (err, results) => {
        if (err || results.length === 0) {
            console.error('Erro ao buscar usuário:', err);
            return res.render('error', { mensagem: 'Usuário não encontrado' });
        }
        
        const usuario = results[0];
        usuario.criado_em = new Date(usuario.criado_em).toLocaleDateString('pt-BR');
        
        res.render('admin/editar-usuario', { 
            usuario,
            mensagem: ''
        });
    });
});

// Rota para atualizar usuário (mantém a mesma do exemplo anterior)
app.post('/admin/usuarios/atualizar', (req, res) => {
    const { id, nome, email, senha, grupo_u } = req.body;
    
    if (!id || !nome || !email || !grupo_u) {
        return res.render('error', { mensagem: 'Preencha todos os campos obrigatórios' });
    }
    
    db.query('SELECT id_usuarios FROM usuarios WHERE email = ? AND id_usuarios != ?', 
    [email, id], (err, results) => {
        if (err) {
            console.error('Erro ao verificar email:', err);
            return res.render('error', { mensagem: 'Erro no servidor' });
        }
        
        if (results.length > 0) {
            return res.render('error', { mensagem: 'Email já está em uso por outro usuário' });
        }
        
        let query, params;
        if (senha) {
            query = 'UPDATE usuarios SET nome = ?, email = ?, senha = ?, grupo_u = ? WHERE id_usuarios = ?';
            params = [nome, email, senha, grupo_u, id];
        } else {
            query = 'UPDATE usuarios SET nome = ?, email = ?, grupo_u = ? WHERE id_usuarios = ?';
            params = [nome, email, grupo_u, id];
        }
        
        db.query(query, params, (err) => {
            if (err) {
                console.error('Erro ao atualizar usuário:', err);
                return res.render('error', { mensagem: 'Erro ao atualizar usuário' });
            }
            
            res.redirect('/admin/usuarios?success=1');
        });
    });
});

// Rota para exibir formulário de novo usuário
app.get('/admin/usuarios/novo', (req, res) => {
    res.render('admin/novo-usuario', { 
        usuario: null,
        mensagem: ''
    });
});

// Rota para processar novo usuário
app.post('/admin/usuarios/criar', (req, res) => {
    const { nome, email, senha, grupo_u } = req.body;
    
    if (!nome || !email || !senha || !grupo_u) {
        return res.render('admin/novo-usuario', { 
            usuario: req.body,
            mensagem: 'Preencha todos os campos obrigatórios'
        });
    }
    
    db.query('SELECT email FROM usuarios WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('Erro ao verificar email:', err);
            return res.render('error', { mensagem: 'Erro no servidor' });
        }
        
        if (results.length > 0) {
            return res.render('admin/novo-usuario', { 
                usuario: req.body,
                mensagem: 'Email já está em uso'
            });
        }
        
        db.query(
            'INSERT INTO usuarios (nome, email, senha, grupo_u) VALUES (?, ?, ?, ?)',
            [nome, email, senha, grupo_u],
            (err, results) => {
                if (err) {
                    console.error('Erro ao criar usuário:', err);
                    return res.render('error', { mensagem: 'Erro ao criar usuário' });
                }
                
                res.redirect('/admin/usuarios?success=Usuário criado com sucesso');
            }
        );
    });
});

// Rota para deletar usuário
app.post('/admin/usuarios/excluir/:id', (req, res) => {
    const userId = req.params.id;
    
    db.query('DELETE FROM usuarios WHERE id_usuarios = ?', [userId], (err) => {
        if (err) {
            console.error('Erro ao excluir usuário:', err);
            return res.render('error', { mensagem: 'Erro ao excluir usuário' });
        }
        
        res.redirect('/admin/usuarios?success=Usuário excluído com sucesso');
    });
});

app.listen(3000, () => console.log("Servidor Online"));