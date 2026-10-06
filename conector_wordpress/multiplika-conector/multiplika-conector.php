<?php
/**
 * Plugin Name:       Multiplika Conector
 * Description:       Permite que la gestión documental de Multiplika haga copias de seguridad de esta web, compruebe que nadie ha modificado los archivos de WordPress, lea el registro de errores y actualice plugins. Solo atiende a usuarios administradores que entren con una contraseña de aplicación.
 * Version:           1.3.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Multiplika
 * License:           GPLv2 or later
 * Text Domain:       multiplika-conector
 *
 * Todo va por la API REST de WordPress, en /wp-json/multiplika/v1/, y solo
 * para usuarios con permiso de administración (manage_options): no abre
 * ninguna puerta que un administrador no tenga ya. Ver
 * docs/gestion-documental.md → "Webs y redes sociales" en el repositorio de
 * la gestión documental.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('MKC_VERSION', '1.3.0');
define('MKC_FIN_SENTENCIA', "\n-- MKC_FIN_SENTENCIA\n");
define('MKC_PATRON_COPIA', '/^copia-\d{8}-\d{6}-[A-Za-z0-9]{12}\.zip$/');

add_action('rest_api_init', 'mkc_registrar_rutas');

function mkc_registrar_rutas()
{
    $permiso = function () {
        return current_user_can('manage_options');
    };
    $rutas = array(
        array('/estado', 'GET', 'mkc_estado'),
        array('/integridad', 'GET', 'mkc_integridad'),
        array('/errores', 'GET', 'mkc_errores'),
        array('/copias', 'GET', 'mkc_listar_copias'),
        array('/copias', 'POST', 'mkc_crear_copia'),
        array('/copias/(?P<nombre>[A-Za-z0-9.\-]+)', 'DELETE', 'mkc_borrar_copia'),
        array('/copias/(?P<nombre>[A-Za-z0-9.\-]+)/descargar', 'GET', 'mkc_descargar_copia'),
        array('/copias/(?P<nombre>[A-Za-z0-9.\-]+)/restaurar', 'POST', 'mkc_restaurar_copia'),
        array('/actualizar', 'POST', 'mkc_actualizar'),
        array('/seo/(?P<id>\d+)', 'GET', 'mkc_leer_seo'),
        array('/seo/(?P<id>\d+)', 'POST', 'mkc_escribir_seo'),
        array('/bd/esquema', 'GET', 'mkc_bd_esquema'),
        array('/bd/transaccion', 'POST', 'mkc_bd_transaccion'),
        array('/geo', 'GET', 'mkc_leer_geo'),
        array('/geo', 'POST', 'mkc_escribir_geo'),
    );
    foreach ($rutas as $r) {
        register_rest_route('multiplika/v1', $r[0], array(
            'methods' => $r[1],
            'callback' => $r[2],
            'permission_callback' => $permiso,
        ));
    }
}

function mkc_cargar_admin()
{
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
    require_once ABSPATH . 'wp-admin/includes/theme.php';
    require_once ABSPATH . 'wp-admin/includes/update.php';
    require_once ABSPATH . 'wp-admin/includes/misc.php';
}

// --- Directorio de copias: dentro de wp-content, protegido y con nombres
// imposibles de adivinar (la protección por .htaccess no vale en Nginx).

function mkc_directorio_copias()
{
    $dir = WP_CONTENT_DIR . '/multiplika-copias';
    if (!is_dir($dir)) {
        wp_mkdir_p($dir);
    }
    if (!file_exists($dir . '/.htaccess')) {
        file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
    }
    if (!file_exists($dir . '/index.php')) {
        file_put_contents($dir . '/index.php', "<?php // Silencio.\n");
    }
    return $dir;
}

function mkc_ruta_copia($nombre)
{
    if (!preg_match(MKC_PATRON_COPIA, $nombre)) {
        return new WP_Error('mkc_nombre', 'Nombre de copia no válido', array('status' => 400));
    }
    $ruta = mkc_directorio_copias() . '/' . $nombre;
    if (!file_exists($ruta)) {
        return new WP_Error('mkc_no_existe', 'No existe esa copia', array('status' => 404));
    }
    return $ruta;
}

// --- Estado: versiones, actualizaciones pendientes y espacio

function mkc_estado()
{
    global $wp_version, $wpdb;
    mkc_cargar_admin();
    wp_version_check();
    wp_update_plugins();
    wp_update_themes();

    $nucleo = null;
    foreach ((array) get_core_updates() as $u) {
        if (isset($u->response) && $u->response === 'upgrade') {
            $nucleo = $u->current;
            break;
        }
    }
    $pendientes_plugins = get_site_transient('update_plugins');
    $plugins = array();
    foreach (get_plugins() as $archivo => $datos) {
        $nueva = isset($pendientes_plugins->response[$archivo]) ? $pendientes_plugins->response[$archivo]->new_version : null;
        $plugins[] = array(
            'plugin' => $archivo, 'nombre' => $datos['Name'], 'version' => $datos['Version'],
            'activo' => is_plugin_active($archivo), 'version_nueva' => $nueva,
        );
    }
    $pendientes_temas = get_site_transient('update_themes');
    $temas = array();
    foreach (wp_get_themes() as $slug => $tema) {
        $temas[] = array(
            'tema' => $slug, 'nombre' => $tema->get('Name'), 'version' => $tema->get('Version'),
            'activo' => get_stylesheet() === $slug,
            'version_nueva' => isset($pendientes_temas->response[$slug]['new_version']) ? $pendientes_temas->response[$slug]['new_version'] : null,
        );
    }
    $dir = mkc_directorio_copias();
    return array(
        'conector' => MKC_VERSION,
        'wordpress' => $wp_version,
        'wordpress_nueva' => $nucleo,
        'php' => PHP_VERSION,
        'base_datos' => $wpdb->db_server_info(),
        'plugins' => $plugins,
        'temas' => $temas,
        'espacio_libre' => @disk_free_space($dir) ?: null,
        'espacio_total' => @disk_total_space($dir) ?: null,
        'ocupado_copias' => mkc_tamano_directorio($dir),
        'actualizar_sin_credenciales' => get_filesystem_method() === 'direct',
        'multisitio' => is_multisite(),
    );
}

function mkc_tamano_directorio($dir)
{
    $total = 0;
    foreach (glob($dir . '/copia-*.zip') ?: array() as $f) {
        $total += filesize($f);
    }
    return $total;
}

// --- Integridad: archivos de WordPress cambiados o añadidos, y PHP en uploads

function mkc_integridad()
{
    global $wp_version;
    mkc_cargar_admin();
    $locale = get_locale();
    $sumas = get_core_checksums($wp_version, $locale ?: 'en_US');
    if (!$sumas && $locale !== 'en_US') {
        $sumas = get_core_checksums($wp_version, 'en_US');
    }
    if (!$sumas) {
        return new WP_Error('mkc_sumas', 'No se han podido descargar las sumas de control de WordPress.org', array('status' => 502));
    }
    $modificados = array();
    $faltan = array();
    foreach ($sumas as $archivo => $md5) {
        if (strpos($archivo, 'wp-content/') === 0) {
            continue; // temas y plugins por defecto: el cliente puede tocarlos
        }
        $ruta = ABSPATH . $archivo;
        if (!file_exists($ruta)) {
            $faltan[] = $archivo;
        } elseif (md5_file($ruta) !== $md5) {
            $modificados[] = $archivo;
        }
    }
    $sobran = array();
    foreach (array('wp-admin', 'wp-includes') as $carpeta) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(ABSPATH . $carpeta, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) {
            $rel = substr($f->getPathname(), strlen(ABSPATH));
            if ($f->isFile() && substr($rel, -4) === '.php' && !isset($sumas[$rel])) {
                $sobran[] = $rel;
                if (count($sobran) >= 100) {
                    break 2;
                }
            }
        }
    }
    $php_en_subidas = array();
    $subidas = wp_upload_dir();
    if (is_dir($subidas['basedir'])) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($subidas['basedir'], FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) {
            if ($f->isFile() && preg_match('/\.(php\d?|phtml|phar)$/i', $f->getFilename()) && $f->getFilename() !== 'index.php') {
                $php_en_subidas[] = substr($f->getPathname(), strlen(ABSPATH));
                if (count($php_en_subidas) >= 100) {
                    break;
                }
            }
        }
    }
    return array(
        'version' => $wp_version, 'revisados' => count($sumas),
        'modificados' => $modificados, 'faltan' => $faltan, 'sobran' => $sobran, 'php_en_subidas' => $php_en_subidas,
    );
}

// --- Registro de errores: las últimas líneas

function mkc_errores($peticion)
{
    $lineas = max(1, min(500, (int) ($peticion->get_param('lineas') ?: 100)));
    $ruta = (defined('WP_DEBUG_LOG') && is_string(WP_DEBUG_LOG)) ? WP_DEBUG_LOG : WP_CONTENT_DIR . '/debug.log';
    if (!file_exists($ruta)) {
        $ruta = ini_get('error_log');
    }
    if (!$ruta || !file_exists($ruta) || !is_readable($ruta)) {
        return array('hay_registro' => false, 'activado' => defined('WP_DEBUG_LOG') && WP_DEBUG_LOG, 'lineas' => array());
    }
    $tam = filesize($ruta);
    $f = fopen($ruta, 'rb');
    fseek($f, max(0, $tam - 65536));
    $texto = stream_get_contents($f);
    fclose($f);
    $todas = preg_split('/\r?\n/', trim($texto));
    return array(
        'hay_registro' => true, 'tamano' => $tam, 'modificado' => gmdate('c', filemtime($ruta)),
        'lineas' => array_slice($todas, -$lineas),
    );
}

// --- Copias de seguridad

function mkc_listar_copias()
{
    $dir = mkc_directorio_copias();
    $copias = array();
    foreach (glob($dir . '/copia-*.zip') ?: array() as $f) {
        $copias[] = array('nombre' => basename($f), 'tamano' => filesize($f), 'fecha' => gmdate('c', filemtime($f)));
    }
    usort($copias, function ($a, $b) {
        return strcmp($b['nombre'], $a['nombre']);
    });
    return array('copias' => $copias, 'espacio_libre' => @disk_free_space($dir) ?: null, 'ocupado' => mkc_tamano_directorio($dir));
}

function mkc_valor_sql($v)
{
    global $wpdb;
    if ($v === null) {
        return 'NULL';
    }
    return "'" . $wpdb->_real_escape($v) . "'";
}

function mkc_volcar_base_datos($archivo)
{
    global $wpdb;
    $f = fopen($archivo, 'wb');
    $tablas = $wpdb->get_col($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($wpdb->prefix) . '%'));
    foreach ($tablas as $tabla) {
        $crear = $wpdb->get_row("SHOW CREATE TABLE `$tabla`", ARRAY_N);
        if (!$crear) {
            continue;
        }
        fwrite($f, "DROP TABLE IF EXISTS `$tabla`" . MKC_FIN_SENTENCIA);
        fwrite($f, $crear[1] . MKC_FIN_SENTENCIA);
        for ($desde = 0; ; $desde += 500) {
            $filas = $wpdb->get_results("SELECT * FROM `$tabla` LIMIT $desde, 500", ARRAY_A);
            if (!$filas) {
                break;
            }
            $columnas = '`' . implode('`, `', array_keys($filas[0])) . '`';
            $valores = array();
            foreach ($filas as $fila) {
                $valores[] = '(' . implode(', ', array_map('mkc_valor_sql', array_values($fila))) . ')';
            }
            fwrite($f, "INSERT INTO `$tabla` ($columnas) VALUES\n" . implode(",\n", $valores) . MKC_FIN_SENTENCIA);
        }
    }
    fclose($f);
    return count($tablas);
}

function mkc_crear_copia()
{
    global $wp_version, $wpdb;
    if (!class_exists('ZipArchive')) {
        return new WP_Error('mkc_zip', 'El servidor no tiene la extensión ZipArchive de PHP', array('status' => 500));
    }
    mkc_cargar_admin();
    @set_time_limit(0);
    $dir = mkc_directorio_copias();
    $nombre = 'copia-' . gmdate('Ymd-His') . '-' . wp_generate_password(12, false) . '.zip';
    $sql = wp_tempnam('mkc-sql');
    $tablas = mkc_volcar_base_datos($sql);

    $zip = new ZipArchive();
    if ($zip->open($dir . '/' . $nombre, ZipArchive::CREATE) !== true) {
        @unlink($sql);
        return new WP_Error('mkc_zip', 'No se puede escribir la copia', array('status' => 500));
    }
    $zip->addFile($sql, 'database.sql');
    $omitir = array(realpath($dir), realpath(WP_CONTENT_DIR . '/cache'), realpath(WP_CONTENT_DIR . '/upgrade'));
    $archivos = 0;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(WP_CONTENT_DIR, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) {
        $ruta = $f->getPathname();
        foreach ($omitir as $o) {
            if ($o && strpos($ruta, $o) === 0) {
                continue 2;
            }
        }
        if ($f->isFile() && is_readable($ruta)) {
            $zip->addFile($ruta, 'wp-content/' . substr($ruta, strlen(WP_CONTENT_DIR) + 1));
            $archivos++;
        }
    }
    $zip->addFromString('multiplika.json', wp_json_encode(array(
        'conector' => MKC_VERSION, 'wordpress' => $wp_version, 'fecha' => gmdate('c'),
        'prefijo' => $wpdb->prefix, 'tablas' => $tablas, 'archivos' => $archivos,
    )));
    $ok = $zip->close();
    @unlink($sql);
    if (!$ok) {
        return new WP_Error('mkc_zip', 'No se ha podido terminar la copia (¿falta espacio?)', array('status' => 500));
    }
    return array('nombre' => $nombre, 'tamano' => filesize($dir . '/' . $nombre), 'tablas' => $tablas, 'archivos' => $archivos,
                 'espacio_libre' => @disk_free_space($dir) ?: null);
}

function mkc_borrar_copia($peticion)
{
    $ruta = mkc_ruta_copia($peticion['nombre']);
    if (is_wp_error($ruta)) {
        return $ruta;
    }
    unlink($ruta);
    return array('borrada' => $peticion['nombre']);
}

function mkc_descargar_copia($peticion)
{
    $ruta = mkc_ruta_copia($peticion['nombre']);
    if (is_wp_error($ruta)) {
        return $ruta;
    }
    while (ob_get_level()) {
        ob_end_clean();
    }
    header('Content-Type: application/zip');
    header('Content-Length: ' . filesize($ruta));
    header('Content-Disposition: attachment; filename="' . basename($ruta) . '"');
    readfile($ruta);
    exit;
}

function mkc_restaurar_copia($peticion)
{
    global $wpdb;
    $ruta = mkc_ruta_copia($peticion['nombre']);
    if (is_wp_error($ruta)) {
        return $ruta;
    }
    @set_time_limit(0);
    // Antes de pisar nada, una copia de cómo está ahora: si la restauración
    // sale mal, se puede volver.
    $previa = null;
    if (!$peticion->get_param('sin_copia_previa')) {
        $previa = mkc_crear_copia();
        if (is_wp_error($previa)) {
            return $previa;
        }
    }
    $zip = new ZipArchive();
    if ($zip->open($ruta) !== true) {
        return new WP_Error('mkc_zip', 'La copia está dañada', array('status' => 500));
    }
    $sql = $zip->getFromName('database.sql');
    if ($sql === false) {
        return new WP_Error('mkc_zip', 'La copia no tiene base de datos', array('status' => 500));
    }
    $sentencias = 0;
    $fallos = array();
    $wpdb->suppress_errors(true);
    foreach (explode(MKC_FIN_SENTENCIA, $sql) as $s) {
        if (trim($s) === '') {
            continue;
        }
        if ($wpdb->query($s) === false) {
            $fallos[] = substr($wpdb->last_error, 0, 200);
        }
        $sentencias++;
    }
    $wpdb->suppress_errors(false);
    $archivos = 0;
    $dir_copias = realpath(mkc_directorio_copias());
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $entrada = $zip->getNameIndex($i);
        if (strpos($entrada, 'wp-content/') !== 0 || substr($entrada, -1) === '/' || strpos($entrada, '..') !== false) {
            continue;
        }
        $destino = WP_CONTENT_DIR . '/' . substr($entrada, strlen('wp-content/'));
        if ($dir_copias && strpos($destino, $dir_copias) === 0) {
            continue;
        }
        wp_mkdir_p(dirname($destino));
        file_put_contents($destino, $zip->getFromIndex($i));
        $archivos++;
    }
    $zip->close();
    wp_cache_flush();
    return array(
        'restaurada' => $peticion['nombre'], 'sentencias' => $sentencias, 'fallos' => array_slice($fallos, 0, 20),
        'archivos' => $archivos, 'copia_previa' => $previa ? $previa['nombre'] : null,
    );
}

// --- Actualizar un plugin o un tema

function mkc_actualizar($peticion)
{
    mkc_cargar_admin();
    require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
    $tipo = $peticion->get_param('tipo');
    $elemento = $peticion->get_param('elemento');
    if (get_filesystem_method() !== 'direct') {
        return new WP_Error('mkc_fs', 'Este servidor pide usuario y contraseña de FTP para actualizar: hay que hacerlo desde el escritorio de WordPress', array('status' => 409));
    }
    $skin = new WP_Ajax_Upgrader_Skin();
    if ($tipo === 'plugin') {
        $todos = get_plugins();
        if (!isset($todos[$elemento])) {
            return new WP_Error('mkc_no_existe', 'No existe ese plugin', array('status' => 404));
        }
        $antes = $todos[$elemento]['Version'];
        $estaba_activo = is_plugin_active($elemento);
        wp_update_plugins();
        $resultado = (new Plugin_Upgrader($skin))->upgrade($elemento);
        if ($estaba_activo && !is_plugin_active($elemento)) {
            activate_plugin($elemento);
        }
        wp_clean_plugins_cache();
        $despues = get_plugins();
        $nueva = isset($despues[$elemento]) ? $despues[$elemento]['Version'] : null;
    } elseif ($tipo === 'tema') {
        $tema = wp_get_theme($elemento);
        if (!$tema->exists()) {
            return new WP_Error('mkc_no_existe', 'No existe ese tema', array('status' => 404));
        }
        $antes = $tema->get('Version');
        wp_update_themes();
        $resultado = (new Theme_Upgrader($skin))->upgrade($elemento);
        wp_clean_themes_cache();
        $nueva = wp_get_theme($elemento)->get('Version');
    } else {
        return new WP_Error('mkc_tipo', 'tipo tiene que ser plugin o tema', array('status' => 400));
    }
    $errores = $skin->get_errors();
    if (is_wp_error($resultado) || $resultado === false || $errores->has_errors()) {
        $mensaje = is_wp_error($resultado) ? $resultado->get_error_message() : implode('; ', $errores->get_error_messages());
        return new WP_Error('mkc_actualizar', $mensaje ?: 'No se ha podido actualizar', array('status' => 500));
    }
    return array('tipo' => $tipo, 'elemento' => $elemento, 'version_antes' => $antes, 'version_despues' => $nueva,
                 'actualizado' => $resultado === true && $nueva !== $antes);
}

// --- SEO de una entrada o página: título y descripción para Google.
// Escribe donde los lee el plugin de SEO que tenga la web (Yoast, Rank Math,
// SEOPress). Si no tiene ninguno, los guarda el propio conector y los pone
// él en la página (más abajo). AIOSEO guarda en tablas propias: no se toca.

function mkc_plugin_seo()
{
    if (defined('WPSEO_VERSION')) {
        return 'yoast';
    }
    if (class_exists('RankMath')) {
        return 'rankmath';
    }
    if (defined('SEOPRESS_VERSION')) {
        return 'seopress';
    }
    if (defined('AIOSEO_VERSION')) {
        return 'aioseo';
    }
    return 'conector';
}

function mkc_claves_seo($plugin)
{
    $claves = array(
        'yoast' => array('titulo_seo' => '_yoast_wpseo_title', 'descripcion_seo' => '_yoast_wpseo_metadesc', 'palabra_clave' => '_yoast_wpseo_focuskw'),
        'rankmath' => array('titulo_seo' => 'rank_math_title', 'descripcion_seo' => 'rank_math_description', 'palabra_clave' => 'rank_math_focus_keyword'),
        'seopress' => array('titulo_seo' => '_seopress_titles_title', 'descripcion_seo' => '_seopress_titles_desc', 'palabra_clave' => '_seopress_analysis_target_kw'),
        'conector' => array('titulo_seo' => '_mkc_titulo_seo', 'descripcion_seo' => '_mkc_descripcion_seo', 'palabra_clave' => '_mkc_palabra_clave'),
    );
    return isset($claves[$plugin]) ? $claves[$plugin] : null;
}

function mkc_valores_seo($id, $plugin)
{
    $valores = array('plugin_seo' => $plugin, 'id' => $id, 'titulo' => get_the_title($id), 'enlace' => get_permalink($id));
    foreach (mkc_claves_seo($plugin) as $campo => $meta) {
        $valores[$campo] = (string) get_post_meta($id, $meta, true);
    }
    return $valores;
}

function mkc_leer_seo($peticion)
{
    $id = (int) $peticion['id'];
    if (!get_post($id)) {
        return new WP_Error('mkc_no_existe', 'No existe esa entrada o página', array('status' => 404));
    }
    $plugin = mkc_plugin_seo();
    if (!mkc_claves_seo($plugin)) {
        return new WP_Error('mkc_seo', 'La web usa All in One SEO, que guarda estos datos a su manera: hay que cambiarlos desde su pantalla', array('status' => 409));
    }
    return mkc_valores_seo($id, $plugin);
}

function mkc_escribir_seo($peticion)
{
    $id = (int) $peticion['id'];
    if (!get_post($id)) {
        return new WP_Error('mkc_no_existe', 'No existe esa entrada o página', array('status' => 404));
    }
    $plugin = mkc_plugin_seo();
    $claves = mkc_claves_seo($plugin);
    if (!$claves) {
        return new WP_Error('mkc_seo', 'La web usa All in One SEO, que guarda estos datos a su manera: hay que cambiarlos desde su pantalla', array('status' => 409));
    }
    foreach ($claves as $campo => $meta) {
        $valor = $peticion->get_param($campo);
        if ($valor === null) {
            continue;
        }
        $valor = sanitize_text_field($valor);
        if ($valor === '') {
            delete_post_meta($id, $meta);
        } else {
            update_post_meta($id, $meta, $valor);
        }
    }
    clean_post_cache($id);
    return mkc_valores_seo($id, $plugin);
}

// Sin plugin de SEO, el conector pone el título y la descripción guardados.
add_filter('pre_get_document_title', function ($titulo) {
    if (mkc_plugin_seo() === 'conector' && is_singular()) {
        $propio = get_post_meta(get_queried_object_id(), '_mkc_titulo_seo', true);
        if ($propio) {
            return $propio;
        }
    }
    return $titulo;
}, 20);

add_action('wp_head', function () {
    if (mkc_plugin_seo() === 'conector' && is_singular()) {
        $descripcion = get_post_meta(get_queried_object_id(), '_mkc_descripcion_seo', true);
        if ($descripcion) {
            echo '<meta name="description" content="' . esc_attr($descripcion) . '" />' . "\n";
        }
    }
}, 1);

// --- Base de datos de la web (fase 4): para que la gestión documental la
// consulte y, con los frenos que pone ella (cambios estructurados,
// propuestos y aprobados), la cambie sin abrir la base de datos al exterior.
// Solo tablas de WordPress (las que empiezan por el prefijo de la web).

function mkc_bd_esquema()
{
    global $wpdb;
    $filas = array();
    $tablas = $wpdb->get_col($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($wpdb->prefix) . '%'));
    foreach ($tablas as $tabla) {
        $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM `$tabla`");
        foreach ((array) $wpdb->get_results("DESCRIBE `$tabla`", ARRAY_A) as $c) {
            $filas[] = array('tabla' => $tabla, 'columna' => $c['Field'], 'tipo' => $c['Type'],
                             'pk' => $c['Key'] === 'PRI', 'filas' => $total);
        }
    }
    return $filas;
}

function mkc_bd_sql($plantilla, $params)
{
    global $wpdb;
    if (empty($params)) {
        return $plantilla; // sin parámetros no se toca (un LIKE '%sevilla%' no es un hueco)
    }
    $trozos = explode('%s', $plantilla);
    if (count($trozos) - 1 !== count($params)) {
        return new WP_Error('mkc_bd', 'Parámetros que no cuadran con la sentencia', array('status' => 400));
    }
    $sql = $trozos[0];
    foreach ($params as $i => $v) {
        if ($v === null) {
            $valor = 'NULL';
        } elseif (is_int($v) || is_float($v)) {
            $valor = (string) $v;
        } elseif (is_bool($v)) {
            $valor = $v ? '1' : '0';
        } else {
            $valor = "'" . $wpdb->_real_escape((string) $v) . "'";
        }
        $sql .= $valor . $trozos[$i + 1];
    }
    return $sql;
}

function mkc_bd_transaccion($peticion)
{
    global $wpdb;
    $sentencias = (array) $peticion->get_param('sentencias');
    $solo_lectura = (bool) $peticion->get_param('solo_lectura');
    $limite = max(1, min(1000, (int) ($peticion->get_param('limite') ?: 200)));
    foreach ($sentencias as $s) {
        $sql = isset($s['sql']) ? (string) $s['sql'] : '';
        if (strpos($sql, ';') !== false) {
            return new WP_Error('mkc_bd', 'Solo una sentencia cada vez', array('status' => 400));
        }
        if ($solo_lectura && !preg_match('/^\s*(select|with|show|describe|desc|explain)\b/i', $sql)) {
            return new WP_Error('mkc_bd', 'Solo se admiten consultas de lectura', array('status' => 400));
        }
        if (!$solo_lectura && !preg_match('/^\s*(update|insert|delete|select)\b/i', $sql)) {
            return new WP_Error('mkc_bd', 'Sentencia no permitida', array('status' => 400));
        }
    }
    $wpdb->suppress_errors(true);
    if ($solo_lectura) {
        if ($wpdb->query('START TRANSACTION READ ONLY') === false) {
            $wpdb->query('START TRANSACTION');
        }
    } else {
        $wpdb->query('START TRANSACTION');
    }
    $resultados = array();
    foreach ($sentencias as $s) {
        $sql = mkc_bd_sql($s['sql'], isset($s['params']) ? (array) $s['params'] : array());
        if (is_wp_error($sql)) {
            $wpdb->query('ROLLBACK');
            return $sql;
        }
        if (preg_match('/^\s*(select|with|show|describe|desc|explain)\b/i', $sql)) {
            if (preg_match('/^\s*(select|with)\b/i', $sql)) {
                $sql = 'SELECT * FROM (' . $sql . ') AS mkc_consulta LIMIT ' . ($limite + 1);
            }
            $filas = $wpdb->get_results($sql, ARRAY_A);
            if ($filas === null && $wpdb->last_error) {
                $wpdb->query('ROLLBACK');
                return new WP_Error('mkc_bd', 'Error de la base de datos: ' . $wpdb->last_error, array('status' => 400));
            }
            $filas = (array) $filas;
            $resultados[] = array('afectadas' => count($filas), 'filas' => array_slice($filas, 0, $limite),
                                  'cortado' => count($filas) > $limite);
            continue;
        }
        $afectadas = $wpdb->query($sql);
        if ($afectadas === false) {
            $error = $wpdb->last_error;
            $wpdb->query('ROLLBACK');
            return new WP_Error('mkc_bd', 'Error de la base de datos: ' . $error, array('status' => 400));
        }
        if (isset($s['esperadas']) && $s['esperadas'] !== null && (int) $afectadas !== (int) $s['esperadas']) {
            $wpdb->query('ROLLBACK');
            return new WP_Error('mkc_bd', "Iba a tocar $afectadas fila(s) y se esperaban " . (int) $s['esperadas'] . ': no se ha cambiado nada', array('status' => 409));
        }
        $resultados[] = array('afectadas' => (int) $afectadas, 'ultimo_id' => $wpdb->insert_id ?: null);
    }
    $wpdb->query($solo_lectura ? 'ROLLBACK' : 'COMMIT');
    $wpdb->suppress_errors(false);
    return $resultados;
}

// --- GEO (fase 6): que las IAs puedan leer y entender la web. Tres cosas que
// decide el cliente: qué robots de IA pueden leerla (robots.txt), el archivo
// /llms.txt (resumen de la web para las IAs) y los datos estructurados de la
// empresa (schema.org en la portada).

define('MKC_ROBOTS_IA', 'GPTBot,OAI-SearchBot,ChatGPT-User,ClaudeBot,Claude-SearchBot,PerplexityBot,Google-Extended,Applebot-Extended,CCBot,Bytespider,meta-externalagent');

function mkc_leer_geo()
{
    $bloqueados = (array) get_option('mkc_geo_bloqueados', array());
    $robots = array();
    foreach (explode(',', MKC_ROBOTS_IA) as $bot) {
        $robots[$bot] = !in_array($bot, $bloqueados, true);
    }
    $schema = get_option('mkc_geo_datos_estructurados', '');
    return array(
        'robots' => $robots,
        'robots_txt_fisico' => file_exists(ABSPATH . 'robots.txt'),
        'llms_txt' => (string) get_option('mkc_geo_llms_txt', ''),
        'llms_txt_fisico' => file_exists(ABSPATH . 'llms.txt'),
        'datos_estructurados' => $schema ? json_decode($schema, true) : null,
    );
}

function mkc_escribir_geo($peticion)
{
    $robots = $peticion->get_param('robots');
    if (is_array($robots)) {
        $bloqueados = array();
        foreach (explode(',', MKC_ROBOTS_IA) as $bot) {
            if (isset($robots[$bot]) && !$robots[$bot]) {
                $bloqueados[] = $bot;
            }
        }
        update_option('mkc_geo_bloqueados', $bloqueados, false);
    }
    $llms = $peticion->get_param('llms_txt');
    if ($llms !== null) {
        update_option('mkc_geo_llms_txt', wp_strip_all_tags((string) $llms, false), false);
    }
    $schema = $peticion->get_param('datos_estructurados');
    if ($schema !== null) {
        update_option('mkc_geo_datos_estructurados', $schema ? wp_json_encode($schema) : '', true);
    }
    return mkc_leer_geo();
}

add_filter('robots_txt', function ($salida) {
    $bloqueados = (array) get_option('mkc_geo_bloqueados', array());
    foreach ($bloqueados as $bot) {
        $salida .= "\nUser-agent: $bot\nDisallow: /\n";
    }
    return $salida;
}, 20);

add_action('init', function () {
    $ruta = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '', PHP_URL_PATH);
    if ($ruta === '/llms.txt') {
        $texto = get_option('mkc_geo_llms_txt', '');
        if ($texto) {
            header('Content-Type: text/plain; charset=utf-8');
            echo $texto;
            exit;
        }
    }
}, 1);

add_action('wp_head', function () {
    if (!is_front_page()) {
        return;
    }
    $schema = get_option('mkc_geo_datos_estructurados', '');
    if ($schema) {
        echo '<script type="application/ld+json">' . $schema . '</script>' . "\n";
    }
}, 5);
