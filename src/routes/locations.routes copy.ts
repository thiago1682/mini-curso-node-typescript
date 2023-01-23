import { Router } from "express";
import multer from "multer";
import knex from "../database/connection";
import multerConfig from '../config/multer';

// cria uma instância do Router do express
const locationsRouter = Router();

// configuração do multer para lidar com upload de arquivos
const upload = multer(multerConfig);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// rota para buscar informações de locais com base em filtros de cidade, estado e itens específicos
locationsRouter.get("/", async (request, response) => {
  const { city, uf, items } = request.query;
  
  // transforma a string de itens em array e converte cada item para número
  const parsedItems = <any>String(items)
    .split(",")
    .map((item) => Number(item.trim()));
    
  // busca no banco de dados os locais que possuem os itens especificados
  // e que sejam da cidade e estado especificados
  const location = await knex("locations")
    .join("location_items", "locations.id", "=", "location_items.location_id")
    .whereIn("location_items.item_id", parsedItems)
    .where("city", String(city))
    .where("uf", String(uf))
    .distinct()
    .select("locations.*");
  
  return response.json(location);
  
});


// rota para buscar informações de um local específico com base no ID
locationsRouter.get("/:id", async (request, response) => {
  const { id } = request.params;

  // busca o local específico no banco de dados
  const location = await knex("locations").where("id", id).first();

  // se o local não for encontrado, retorna uma mensagem de erro
  if (!location) {
    return response.status(400).json({ message: "location not found." });
  }

  // busca os itens associados ao local
  const items = await knex("items")
    .join("location_items", "items.id", "=", "location_items.item_id")
    .where("location_items.location_id", id)
    .select("items.title");

  return response.json({ location, items });
});

// rota para criar um novo local
locationsRouter.post("/", async (request, response) => {
  const { name, email, whatsapp, latitude, longitude, city, uf, items } =
    request.body;

  // objeto com as informa ou do novo local
  const location: any = {
    image: "fake-image.jpeg",
    name,
    email,
    whatsapp,
    latitude,
    longitude,
    city,
    uf,
  };

  // inicia uma transação no banco de dados
  const transaction = await knex.transaction();

  // insere os dados no banco de dados e retorna o ID gerado
  const newIds = await transaction("locations").insert(location);

  // armazena o ID gerado
  const location_id = newIds[0];

  // se houver itens especificados, insere os relacionamentos entre os itens e o local no banco de dados
  if (items?.length) {
    const locationItens = await Promise.all(
      items.map(async (item_id: number) => {
        // busca o item específico no banco de dados
        const selectedItem = await transaction("items")
          .where("id", item_id)
          .first();
        if (!selectedItem) {
          return response.status(400).json({ message: "item not found" });
        }
        return {
          item_id,
          location_id: location_id,
        };
      })
    );

    await transaction("location_items").insert(locationItens);
  }
  //commit the transaction
  await transaction.commit();

  return response.json({
    id: location_id,
    ...location,
  });
});

// rota para atualizar informações de um local específico, incluindo a imagem
locationsRouter.put("/:id", upload.single('image'), async (request, response) => {
  const { id } = request.params;

  // obtém o nome do arquivo da imagem enviada
  const image = request.file?.filename;
  // busca o local no banco de dados
  const location = await knex("locations").where("id", id).first();
  // se o local não for encontrado, retorna uma mensagem de erro
  if (!location) {
    return response.status(400).json({ message: "Location not Found" });
  }

  // atualiza o objeto com as informações atuais e o nome da nova imagem
  const locationUpdated = {
    ...location,
    image,
  };

  // atualiza as informações no banco de dados
  await knex("locations").update(locationUpdated).where("id", id);

  return response.json(locationUpdated);
});

export default locationsRouter;
