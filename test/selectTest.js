const oracledb = require('oracledb');

async function run() {
    let connection;

    try {
        // Configura las credenciales y la cadena de conexión a tu base de datos Oracle
        const dbConfig = {
            user: 'C##hotel_bases',
            password: '123',
            connectString: 'localhost:1521/xe' // Reemplaza con tus valores
        };

        console.log(dbConfig);

        // Conecta a la base de datos
        connection = await oracledb.getConnection(dbConfig);

        // Realiza una consulta
        const result = await connection.execute('SELECT * from reseva_hospedaje');

        console.log(result)

        // Imprime los resultados
        console.log(result.rows);


    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) {
            try {
                // Cierra la conexión
                await connection.close();
            } catch (error) {
                console.error('Error al cerrar la conexión:', error);
            }
        }
    }
}

run();
