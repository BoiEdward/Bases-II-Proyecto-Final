const express = require('express');
const session = require('express-session');
const oracledb = require('oracledb');
const ejs = require('ejs');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs'); // Configurar el motor de plantillas EJS

app.use(session({
  secret: 'tu_secreto_aqui', // Cambia esto a una cadena segura
  resave: false,
  saveUninitialized: true
}));

app.use(express.urlencoded({ extended: true }));

// Configuración de la conexión a Oracle
const dbConfig = {
  user: 'C##hotel_bases',
  password: '123',
  connectString: 'localhost:1521/xe' // Reemplaza con tus valores
};

// Ruta de ejemplo
app.get('/', async (req, res) => {
  res.redirect('/mainPage')
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});

// Ruta para mostrar el formulario de inicio de sesión
app.get('/login', (req, res) => {
  res.render(__dirname + '/views/login');
});

// Ruta para procesar la solicitud de inicio de sesión
app.post('/login', async (req, res) => {
  if( !req.session.isLogin ){
    const { cedula, contrasenia } = req.body;

    try {
      // Conectar a Oracle
      const connection = await oracledb.getConnection(dbConfig);

      // Realizar la consulta en la base de datos
      const result = await connection.execute(
        'SELECT * FROM usuario WHERE idusuario = :cedula AND contraseña = :contrasenia',
        [cedula, contrasenia]
      );

      // Liberar la conexión
      await connection.close();

      // Verificar si las credenciales son válidas
      if (result.rows.length > 0) {
        
        req.session.userCedula = result.rows[0][0];
        req.session.userContraseña = result.rows[0][1]; 
        req.session.userRol = result.rows[0][2]; 
        req.session.userTelefono = result.rows[0][3]; 
        req.session.isLogin = true;

        if(result.rows[0][2]=="Cliente" ){
          res.redirect('/mainPage');
        }else{
          res.redirect('/mainPageAdmin')
        }
      } else {
        res.redirect('/login');
      }
    } catch (error) {
      console.error(error);
      res.status(500).send('Error en el servidor');
    }
  }else{
    res.redirect('/mainPage'); // O redirige a la página de inicio de sesión
  }
});

// Ruta para mostrar el formulario de registro
app.get('/registro', (req, res) => {
  res.render(__dirname + '/views/registro');
});

// Ruta para procesar la solicitud de registro
app.post('/registro', async (req, res) => {
  const { cedula, contrasenia, telefono } = req.body;

  try {
    // Validar datos de entrada
    if (!cedula || !contrasenia || !telefono) {
      return res.status(400).send('Datos de entrada incompletos o incorrectos.');
    }

    // Conectar a Oracle
    const connection = await oracledb.getConnection(dbConfig);

    // Realizar la consulta en la base de datos
    const result = await connection.execute(
      'INSERT INTO usuario(idusuario, contraseña, telefono, rol_idrol) VALUES(:cedula, :contrasenia, :telefono, :cliente )',
      [cedula, contrasenia, telefono, "Cliente"]
    );

    await connection.commit();

    // Liberar la conexión
    await connection.close();

    // Verificar si la inserción fue exitosa
    if (result.rowsAffected && result.rowsAffected === 1) {
      // La inserción fue exitosa
      console.log('Registro insertado correctamente.');
      res.redirect('/login');
    } else {
      // La inserción fue errónea o no afectó ninguna fila
      console.error('Error al insertar el registro. No se afectó ninguna fila.');
      res.redirect('/registro');

    }
  } catch (error) {
    // Manejar errores
    console.error('Error en la consulta de inserción:', error);
    res.status(500).send('Error en el servidor');
  }
});

// Ruta para mostrar página principal usuario
app.get('/hospedaje', async (req, res) => {

  if (req.session.isLogin) {
    try{
      // Conectar a Oracle
      const connection = await oracledb.getConnection(dbConfig);

      // Realizar la consulta en la base de datos
      const result = await connection.execute('select * from hospedaje h join tipo_hospedaje th on th.idtipohospedaje = h.tipohospedaje_id ');

      res.render(__dirname + '/views/hospedaje', { userId: req.session.userCedula, hospedajes: result });
    }catch(error){
      console.error('Error en la consulta de inserción:', error);
      res.status(500).send('Error en el servidor');
    }
  } else {
    res.redirect('/login'); // O redirige a la página de inicio de sesión
  }
});

app.post('/crearReserva', async (req, res) => {
  const fechaReservada = req.body.fechaReserva;
  const idHospedaje = req.body.idHospedaje;

  console.log(fechaReservada);

  try {
    // Conectar a Oracle
    const connection = await oracledb.getConnection(dbConfig);

    const result2 = await connection.execute(
      `INSERT INTO reseva_hospedaje(idhospedaje, policancelacion_idpolitica)
       VALUES(:idHospedaje, :politica )
       RETURNING idreserva INTO :idReservaOutput`,
      {
        idHospedaje: idHospedaje,
        politica: 15,
        idReservaOutput: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
      }
    );
    
    var idReservaGenerada = "";
    // Verificar si la inserción fue exitosa
    if (result2.rowsAffected && result2.rowsAffected === 1) {
      idReservaGenerada = result2.outBinds.idReservaOutput;
      console.log(`ID de la reserva generada: ${idReservaGenerada}`);
    } else {
      console.log('Error en la inserción o ninguna fila afectada.');
    }

   const result = await connection.execute(
      'INSERT INTO detalle_reserva( reseva_idreserva, usuario_idcliente, fecha) VALUES(:idReserva, :idUsuario, :fecha )',
      [idReservaGenerada[0], req.session.userCedula, fechaReservada]
    );

    await connection.commit();
    // Liberar la conexión
    await connection.close();

    // Verificar si la inserción fue exitosa
    if (result.rowsAffected && result.rowsAffected === 1) {
      // La inserción fue exitosa
      console.log('Registro insertado correctamente.');
      res.redirect('/hospedaje')
    } else {
      // La inserción fue errónea o no afectó ninguna fila
      console.error('Error al insertar el registro. No se afectó ninguna fila.');
      res.status(500).send('Error al insertar el registro.');
    }
  } catch (error) {
    // Manejar errores
    console.error('Error en la consulta de inserción:', error);
    res.status(500).send('Error en el servidor');
  }
});

// Ruta para procesar cerrar sesion
app.post('/logout', (req, res) => {
  // Destruir la sesión
  req.session.destroy(err => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
      res.send('Error al cerrar sesión');
    } else {
      res.redirect('/login');
    }
  });
});

// Ruta para mostrar página reservar vehiculos
app.get('/vehiculos', async (req, res) => {

  if (req.session.isLogin) {
    try{
      // Conectar a Oracle
      const connection = await oracledb.getConnection(dbConfig);

      // Realizar la consulta en la base de datos
      const result = await connection.execute('select * from auto where udisponible>0');

      res.render(__dirname + '/views/vehiculos', { userId: req.session.userCedula, vehiculos: result });
    }catch(error){
      console.error('Error en la consulta de inserción:', error);
      res.status(500).send('Error en el servidor');
    }
  } else {
    res.redirect('/login'); // O redirige a la página de inicio de sesión
  }
});


app.post('/crearReservaAuto', async (req, res) => {
  // Obtener los datos del cuerpo de la solicitud
  const fechaInicio = req.body.fechaInicio;
  const fechaFinal = req.body.fechaFinal;
  const idAuto = req.body.idAuto;

  try{
    const connection = await oracledb.getConnection(dbConfig);

    const result2 = await connection.execute(
      `INSERT INTO reserva_auto( id, auto_id, cantidad, policancelacion_idpolitica, fechasalida, fechaentrada, idusuario )
      VALUES(:id, :autoid, :cantidad, :politica, :fechasalida, :fechaentrada, :idusuario )`,
      [1, idAuto, 1, 15, fechaInicio, fechaFinal, req.session.userCedula]
    );

    await connection.commit();
    // Liberar la conexión
    await connection.close();
    
    res.redirect('/vehiculos');
  }catch(error){
    console.error('Error en la consulta de inserción:', error);
    res.status(500).send('Error en el servidor');
  }
});


// Ruta para mostrar página reservar paquetes
app.get('/paquetes', async (req, res) => {

  if (req.session.isLogin) {
    try{
      // Conectar a Oracle
      const connection = await oracledb.getConnection(dbConfig);

      // Realizar la consulta en la base de datos
      const result = await connection.execute('select * from paqueteturistico p join auto a on a.id=p.idauto join hospedaje h on h.idhospedaje=p.idhospedaje join tipo_hospedaje t on t.idtipohospedaje=h.tipohospedaje_id');

      console.log(result.rows)
      res.render(__dirname + '/views/paquetes', { userId: req.session.userCedula, paquetes: result });
    }catch(error){
      console.error('Error en la consulta de inserción:', error);
      res.status(500).send('Error en el servidor');
    }
  } else {
    res.redirect('/login'); // O redirige a la página de inicio de sesión
  }
});


// Ruta para mostrar página reservar paquetes
app.get('/mainPage', (req, res) => {
  if( req.session.isLogin ){
    res.render(__dirname + '/views/mainPage');
  }else{
    res.redirect('login')
  }
});

// Ruta para mostrar página reservar paquetes
app.get('/mainPageAdmin', (req, res) => {
  if( req.session.isLogin && req.session.userRol=='Administrador' ){
    res.render(__dirname + '/views/mainPageAdmin');
  }else{
    res.redirect('mainPage')
  }
});

// Ruta para mostrar página reservar paquetes
app.get('/crearHospedaje', async (req, res) => {
  if( req.session.isLogin && req.session.userRol=='Administrador' ){
    try{
      // Conectar a Oracle
      const connection = await oracledb.getConnection(dbConfig);

      // Realizar la consulta en la base de datos
      const result = await connection.execute('select * from tipo_hospedaje');

      res.render(__dirname + '/views/crearHospedaje', { userId: req.session.userCedula, tipoHospedajes: result });
    }catch(error){
      console.error('Error en la consulta de inserción:', error);
      res.status(500).send('Error en el servidor');
    }
  }else{
    res.redirect('mainPage')
  }
});

// Ruta para mostrar página crear autos
app.get('/crearAuto', async (req, res) => {
  if( req.session.isLogin && req.session.userRol=='Administrador' ){
    try{
      // Conectar a Oracle
      const connection = await oracledb.getConnection(dbConfig);

      // Realizar la consulta en la base de datos
      const result = await connection.execute('select * from marca');

      res.render(__dirname + '/views/crearAuto', { userId: req.session.userCedula, marcas: result });
    }catch(error){
      console.error('Error en la consulta de inserción:', error);
      res.status(500).send('Error en el servidor');
    }
  }else{
    res.redirect('mainPage')
  }
});

// Ruta para mostrar página crear paquetes
app.get('/crearPaquete', async (req, res) => {
  if( req.session.isLogin && req.session.userRol=='Administrador' ){
    try{
      // Conectar a Oracle
      const connection = await oracledb.getConnection(dbConfig);

      // Realizar la consulta en la base de datos
      const result = await connection.execute('select * from auto');
      const result2 = await connection.execute('select * from hospedaje');

      res.render(__dirname + '/views/crearPaquete', { userId: req.session.userCedula, autos: result, hospedajes: result2 });
    }catch(error){
      console.error('Error en la consulta de inserción:', error);
      res.status(500).send('Error en el servidor');
    }
  }else{
    res.redirect('mainPage')
  }
});

// Ruta para procesar la solicitud de crear hospedaje
app.post('/crearHospedaje', async (req, res) => {
  const nombreHospedaje = req.body.nombreHospedaje;
  const tipoHospedaje = req.body.tipoHospedaje;

  try {
    // Conectar a Oracle
    const connection = await oracledb.getConnection(dbConfig);

    // Realizar la consulta en la base de datos
    const result = await connection.execute(
      'INSERT INTO hospedaje( tipohospedaje_id, idhospedaje, nombre ) VALUES(:tipohospedaje, :idhospedaje, :nombre )',
      [tipoHospedaje, 1, nombreHospedaje]
    );

    await connection.commit();

    // Liberar la conexión
    await connection.close();

    // Verificar si la inserción fue exitosa
    if (result.rowsAffected && result.rowsAffected === 1) {
      // La inserción fue exitosa
      console.log('Registro insertado correctamente.');
      res.redirect('/mainPageAdmin');
    } else {
      // La inserción fue errónea o no afectó ninguna fila
      console.error('Error al insertar el registro. No se afectó ninguna fila.');
      res.status(500).send('Error al insertar el registro.');
    }
  } catch (error) {
    // Manejar errores
    console.error('Error en la consulta de inserción:', error);
    res.status(500).send('Error en el servidor');
  }
});

// Ruta para procesar la solicitud de crear auto
app.post('/crearAuto', async (req, res) => {
  const modelo = req.body.modeloAuto;
  const kilometraje = req.body.kilometraje;
  const unidades = req.body.unidades;
  const marcaAuto = req.body.marcaAuto;

  try {
    // Conectar a Oracle
    const connection = await oracledb.getConnection(dbConfig);

    // Realizar la consulta en la base de datos
    const result = await connection.execute(
      'INSERT INTO auto( id, marca_nombre, kilometraje, modelo, udisponible ) VALUES(:id, :marca_nombre, :kilometraje, :modelo, :unidades )',
      [1, marcaAuto, kilometraje, modelo, unidades]
    );

    await connection.commit();

    // Liberar la conexión
    await connection.close();

    // Verificar si la inserción fue exitosa
    if (result.rowsAffected && result.rowsAffected === 1) {
      // La inserción fue exitosa
      console.log('Registro insertado correctamente.');
      res.redirect('/mainPageAdmin');
    } else {
      // La inserción fue errónea o no afectó ninguna fila
      console.error('Error al insertar el registro. No se afectó ninguna fila.');
      res.status(500).send('Error al insertar el registro.');
    }
  } catch (error) {
    // Manejar errores
    console.error('Error en la consulta de inserción:', error);
    res.status(500).send('Error en el servidor');
  }
});

// Ruta para procesar la solicitud de crear marca
app.post('/crearMarca', async (req, res) => {
  const marcaAuto = req.body.marca;

  try {
    // Conectar a Oracle
    const connection = await oracledb.getConnection(dbConfig);

    const result2 = await connection.execute('select * from marca where nombre=:marca', [marcaAuto]);

    if(result2.rows.length===0 ){
      // Realizar la consulta en la base de datos
      const result = await connection.execute(
        'INSERT INTO marca( nombre ) VALUES(:nombre )',
        [marcaAuto]
      );

      await connection.commit();

      // Liberar la conexión
      await connection.close();

      // Verificar si la inserción fue exitosa
      if (result.rowsAffected && result.rowsAffected === 1) {
        // La inserción fue exitosa
        console.log('Registro insertado correctamente.');
        res.redirect('/mainPageAdmin');
      } else {
        // La inserción fue errónea o no afectó ninguna fila
        console.error('Error al insertar el registro. No se afectó ninguna fila.');
        res.status(500).send('Error al insertar el registro.');
      }
    }else{
      console.error('Error en la consulta de inserción, Ya existe la marca');
      res.status(500).send('Error en el servidor');
    }
  } catch (error) {
    // Manejar errores
    console.error('Error en la consulta de inserción:', error);
    res.status(500).send('Error en el servidor');
  }
});

// Ruta para procesar la solicitud de crear paquete
app.post('/crearPaquete', async (req, res) => {
  const nombre = req.body.nombre;
  const descripcion = req.body.descripcion;
  const duracion = req.body.duracion;
  const auto = req.body.auto;
  const hospedaje = req.body.hospedaje;


  try {
    // Conectar a Oracle
    const connection = await oracledb.getConnection(dbConfig);

    // Realizar la consulta en la base de datos
    const result = await connection.execute(
      'INSERT INTO paqueteturistico( idpaquete, descripcion, idauto, idhospedaje, nombre, duracion ) VALUES(:idpaquete, :descripcion, :idauto, :idhospedaje, :nombre, :duracion )',
      [1, descripcion, auto, hospedaje, nombre, duracion]
    );

    await connection.commit();

    // Liberar la conexión
    await connection.close();

    // Verificar si la inserción fue exitosa
    if (result.rowsAffected && result.rowsAffected === 1) {
      // La inserción fue exitosa
      console.log('Registro insertado correctamente.');
      res.redirect('/mainPageAdmin');
    } else {
      // La inserción fue errónea o no afectó ninguna fila
      console.error('Error al insertar el registro. No se afectó ninguna fila.');
      res.status(500).send('Error al insertar el registro.');
    }
  } catch (error) {
    // Manejar errores
    console.error('Error en la consulta de inserción:', error);
    res.status(500).send('Error en el servidor');
  }
});

// Ruta para procesar la solicitud de crear paquete
app.post('/registrarPaquete', async (req, res) => {
  const idReserva = req.body.idReserva;
  const fechaActual = new Date();

  const dia = fechaActual.getDate();
  const mes = fechaActual.getMonth() + 1;
  const año = fechaActual.getFullYear();

  const fechaFormateada = `${dia}/${mes}/${año}`;

  try {
    // Conectar a Oracle
    const connection = await oracledb.getConnection(dbConfig);

    // Realizar la consulta en la base de datos
    const result = await connection.execute(
      'INSERT INTO reserva_paquete( policancelacion_idpolitica, usuario_idcliente, paqueteturistico_idpaquete, fecha ) VALUES(:policancelacion_idpolitica, :usuario_idcliente, :paqueteturistico_idpaquete, :fecha )',
      [15, req.session.userCedula, idReserva, fechaFormateada]
    );

    await connection.commit();

    // Liberar la conexión
    await connection.close();

    // Verificar si la inserción fue exitosa
    if (result.rowsAffected && result.rowsAffected === 1) {
      // La inserción fue exitosa
      console.log('Registro insertado correctamente.');
      res.redirect('/mainPageAdmin');
    } else {
      // La inserción fue errónea o no afectó ninguna fila
      console.error('Error al insertar el registro. No se afectó ninguna fila.');
      res.status(500).send('Error al insertar el registro.');
    }
  } catch (error) {
    // Manejar errores
    console.error('Error en la consulta de inserción:', error);
    res.status(500).send('Error en el servidor');
  }
});



// Ruta para procesar la solicitud de crear hospedaje
app.post('/crearTipoHospedaje', async (req, res) => {
  const nombreHospedaje = req.body.nombreTipoHospedaje;
  const descripcionTipoHospedaje = req.body.descripcionTipoHospedaje;

  try {
    // Conectar a Oracle
    const connection = await oracledb.getConnection(dbConfig);

    // Realizar la consulta en la base de datos
    const result = await connection.execute(
      'INSERT INTO tipo_hospedaje( idtipohospedaje, descripcion, prestigio ) VALUES(:nombreHospedaje, :descripcionTipoHospedaje, :prestigio )',
      [nombreHospedaje, descripcionTipoHospedaje, 0]
    );

    await connection.commit();

    // Liberar la conexión
    await connection.close();

    // Verificar si la inserción fue exitosa
    if (result.rowsAffected && result.rowsAffected === 1) {
      // La inserción fue exitosa
      console.log('Registro insertado correctamente.');
      res.redirect('/mainPageAdmin');
    } else {
      // La inserción fue errónea o no afectó ninguna fila
      console.error('Error al insertar el registro. No se afectó ninguna fila.');
      res.status(500).send('Error al insertar el registro.');
    }
  } catch (error) {
    // Manejar errores
    console.error('Error en la consulta de inserción:', error);
    res.status(500).send('Error en el servidor');
  }
});

app.get('/reservas', async (req,res)=>{

  if (req.session.isLogin) {
    try{
      // Conectar a Oracle
      const connection = await oracledb.getConnection(dbConfig);

      // Realizar la consulta en la base de datos
      const result = await connection.execute('select * from usuario u join detalle_reserva dr on u.idusuario=dr.usuario_idcliente'+
      ' join reseva_hospedaje rh on dr.reseva_idreserva=rh.idreserva'+
      ' join hospedaje h on rh.idhospedaje = h.idhospedaje where u.idusuario = :userid',
      [ req.session.userCedula ]);

      const result2 = await connection.execute('select * from usuario u join reserva_auto ra on ra.idusuario=u.idusuario join auto a on a.id=ra.auto_id where u.idusuario=:userid',
                                               [ req.session.userCedula ]);

      console.log(result2);
      res.render(__dirname + '/views/reservas', { userId: req.session.userCedula, reservasHotel: result, reservasAuto: result2 });
    }catch(error){
      console.error('Error en la consulta de inserción:', error);
      res.status(500).send('Error en el servidor');
    }
  } else {
    console.log('hola')
    res.redirect('/login'); // O redirige a la página de inicio de sesión
  }
}); 