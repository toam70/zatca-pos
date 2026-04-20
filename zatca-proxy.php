<?php
// ZATCA API Proxy - يعمل على أي استضافة تدعم PHP
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, OTP, Authorization, Accept, Accept-Language, Accept-Version');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { http_response_code(405); echo json_encode(['error'=>'Method not allowed']); exit; }

$env    = $_GET['env']    ?? 'sandbox';
$action = $_GET['action'] ?? 'compliance';

$bases = [
  'sandbox'    => 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
  'simulation' => 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
  'production' => 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
];

$paths = [
  'compliance'  => '/compliance',
  'production'  => '/production/csids',
];

if (!isset($bases[$env]) || !isset($paths[$action])) {
  http_response_code(400); echo json_encode(['error'=>'Invalid env or action']); exit;
}

$url  = $bases[$env] . $paths[$action];
$body = file_get_contents('php://input');

$headers = [
  'Content-Type: application/json',
  'Accept: application/json',
  'Accept-Language: ' . ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? 'ar'),
  'Accept-Version: '  . ($_SERVER['HTTP_ACCEPT_VERSION']  ?? 'V2'),
];
if (!empty($_SERVER['HTTP_OTP']))           $headers[] = 'OTP: '           . $_SERVER['HTTP_OTP'];
if (!empty($_SERVER['HTTP_AUTHORIZATION'])) $headers[] = 'Authorization: ' . $_SERVER['HTTP_AUTHORIZATION'];

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => $body,
  CURLOPT_HTTPHEADER     => $headers,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_SSL_VERIFYPEER => true,
  CURLOPT_TIMEOUT        => 30,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error    = curl_error($ch);
curl_close($ch);

if ($error) { http_response_code(502); echo json_encode(['error' => $error]); exit; }

http_response_code($httpCode);
echo $response;
