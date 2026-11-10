# Trainworld

Juego de gestión ferroviaria para navegador, construido con React, Vite y MapLibre GL JS. El mapa usa [OpenFreeMap](https://openfreemap.org/), OpenMapTiles y datos de OpenStreetMap. El frontend se despliega como sitio estático y las ciudades se cargan desde los archivos de mapa incluidos en el juego.

## Desarrollo

```sh
npm ci
npm run dev
```

`npm test` ejecuta las pruebas del modelo y `npm run build` genera el sitio estático en `dist/`.

## GitHub Pages

Sube el proyecto a un repositorio y selecciona **Settings → Pages → Build and deployment → GitHub Actions**. El flujo incluido compila y publica al hacer push a `main`. La base relativa de Vite permite desplegarlo también en un subdirectorio.

## Cómo jugar

En el menú inicial, elige «Nuevo juego» y selecciona un mapa, o usa «Continuar» para recuperar la partida guardada. Construye una vía entre dos ciudades y crea una línea con paradas conectadas. Cada estación admite por defecto dos trenes; puedes ampliar su capacidad y el número máximo de trenes de una línea viene dado por la estación con menor capacidad del recorrido.

Cada dos minutos reales equivalen a un día de juego (24 horas). La velocidad indicada para cada vía está expresada en kilómetros por hora de juego: por ejemplo, recorrer 100 km a 40 km/h requiere 2,5 horas de juego o 12,5 segundos reales, sin esperas. Los trenes esperan si la vía no está disponible o si no hay plaza reservable en su destino. Las vías sencillas no permiten trenes en sentidos opuestos al mismo tiempo; las de doble sentido sí.

Cada estación acumula viajeros por línea y destino mientras transcurre el juego. La demanda depende de la población de origen y destino, la distancia, la frecuencia prevista y una variación diaria; las colas son independientes para cada línea, pero las líneas que conectan el mismo origen y destino comparten la demanda de esos viajeros. Al salir, el tren recoge hasta 200 viajeros que viajan en su sentido; los que no caben siguen esperando y quienes van a otras paradas permanecen a bordo. Los viajeros abandonan gradualmente la cola si esperan demasiado: la paciencia media es de seis horas de juego. El mapa muestra la ocupación de cada tren y el número de viajeros en cada estación con línea y un indicador de afluencia: poca gente (1–24), media (25–99) o mucha (100 o más). Las colas y los pasajeros a bordo se guardan con la partida. Las líneas nuevas empiezan sin viajeros en espera.

Cada llegada genera ingresos en función de los viajeros que han recorrido el tramo y su distancia. La espera del tren antes de salir reduce el importe: si equivale al tiempo de viaje, se cobra la mitad. La estimación de ingresos diarios supone que no hay esperas ni congestión y puede diferir de los ingresos reales. Los trenes nuevos salen de la primera estación y, al reducir la flota, se retira el último tren incluso si está en viaje. La simulación avanza mientras la página está abierta y activa, y la partida se guarda en el navegador.

## Confirmaciones y estadísticas

Las acciones que modifican la partida piden confirmación. Tocar fuera de un menú lo cierra; al tocar un tren se muestran su estado, recorrido y acceso a las estadísticas de su línea.

Las estadísticas financieras conservan su historial. En línea, tren y vía se registran además los tramos completados, el tiempo medio en circulación, la espera media y total antes de salir, los trenes distintos, el ingreso medio por tren, la ocupación media por tramo y los viajeros transportados. Los tiempos se expresan en tiempo de juego y los viajeros se cuentan en cada tramo recorrido y sus cifras anteriores a la introducción de las colas son estimaciones. Estas métricas operativas comienzan a registrarse con esta versión; no se inventan datos históricos ni tiempos incompletos de trenes que ya estuvieran en marcha.

Las llegadas cuentan como ingreso de la compañía, de la línea, del tren, de la vía recorrida y de la ciudad de destino. La construcción o modificación de una vía se imputa íntegramente a esa vía y se reparte entre sus dos ciudades. El coste de crear una línea se imputa a la línea y se reparte por igual entre sus paradas y sus vías. Cada categoría es una vista diferente de los mismos movimientos: no se deben sumar entre sí.

## Mapas y conexión

Los mapas se encuentran en `src/data/maps/`. Para añadir uno, crea otro archivo JSON con la estructura de `iberican.json`: `mapa` contiene nombre, centro y zoom; `ciudades` contiene identificadores únicos dentro del mapa, nombres, coordenadas y población. El selector lo incorporará automáticamente en la siguiente compilación. Las ciudades se cargan localmente; las teselas del mapa siguen necesitando conexión a Internet.

El catálogo inicial de tipos de tren está en `src/data/trainTypes.json`. Actualmente cada línea utiliza el tren estándar y su velocidad depende de la vía.

Mapa: [OpenFreeMap](https://openfreemap.org/), [OpenMapTiles](https://openmaptiles.org/) y © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Las fuentes de referencia de cada mapa se indican en su JSON.
