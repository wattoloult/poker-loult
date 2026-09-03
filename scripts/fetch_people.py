# -*- coding: utf-8 -*-
"""Télécharge les portraits Wikipedia (Wikimedia Commons, PAS de génération) pour le pool
d'avatars "personnalités". Écrit assets/avatars/people/<slug>.jpg + manifest.json (liste
des slugs valides, utilisée par le serveur pour piocher un avatar)."""
import io
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

OUT_DIR = '../avatars/people'
os.makedirs(OUT_DIR, exist_ok=True)
UA = 'PokerLoultAvatarFetch/1.0 (usage privé, local ; contact: n/a)'

# (titre exact de la page Wikipedia anglaise, nom affiché FR optionnel)
NAMES = [
    # Scientifiques / chercheurs
    "Albert Einstein", "Isaac Newton", "Charles Darwin", "Marie Curie", "Nikola Tesla",
    "Stephen Hawking", "Richard Feynman", "Alan Turing", "Galileo Galilei", "Nicolaus Copernicus",
    "Dmitri Mendeleev", "Louis Pasteur", "Thomas Edison", "Benjamin Franklin", "Niels Bohr",
    "J. Robert Oppenheimer", "Ada Lovelace", "Rosalind Franklin", "Katherine Johnson",
    "Neil deGrasse Tyson", "Jane Goodall", "Yuri Gagarin", "Carl Sagan", "Werner Heisenberg",
    "Max Planck", "Michael Faraday", "James Clerk Maxwell", "Gregor Mendel", "Alexander Fleming",
    "Rachel Carson",
    # Écrivains / philosophes
    "William Shakespeare", "Victor Hugo", "Voltaire", "Leo Tolstoy", "Fyodor Dostoevsky",
    "Ernest Hemingway", "Franz Kafka", "George Orwell", "Albert Camus", "Jean-Paul Sartre",
    "Simone de Beauvoir", "Jane Austen", "Mark Twain", "Gabriel García Márquez", "Toni Morrison",
    "Confucius", "Socrates", "Plato", "Aristotle", "Friedrich Nietzsche", "Immanuel Kant",
    "Rumi", "Chinua Achebe", "Molière", "Charles Baudelaire", "Marcel Proust", "Émile Zola",
    "Homer", "Dante Alighieri", "Miguel de Cervantes",
    # Chefs d'État / figures politiques (historiques et actuelles)
    "George Washington", "Abraham Lincoln", "Barack Obama", "Donald Trump", "Joe Biden",
    "John F. Kennedy", "Franklin D. Roosevelt", "Winston Churchill", "Charles de Gaulle",
    "Napoleon", "Louis XIV", "Nicolas Sarkozy", "Emmanuel Macron", "François Mitterrand",
    "Jacques Chirac", "Jordan Bardella", "Marine Le Pen", "Angela Merkel", "Vladimir Putin",
    "Xi Jinping", "Mahatma Gandhi", "Nelson Mandela", "Kwame Nkrumah", "Jawaharlal Nehru",
    "Fidel Castro", "Simón Bolívar", "Elizabeth II", "Charles III", "Louis XVI",
    "Marie Antoinette", "Cleopatra", "Julius Caesar", "Genghis Khan", "Alexander the Great",
    "Otto von Bismarck", "Vladimir Lenin", "Mikhail Gorbachev", "Golda Meir",
    "Margaret Thatcher", "Indira Gandhi", "Justin Trudeau", "Volodymyr Zelensky",
    "Recep Tayyip Erdoğan", "Shinzo Abe", "Lee Kuan Yew", "Henry VIII", "Elizabeth I",
    "Peter the Great", "Catherine the Great", "Ho Chi Minh", "Mao Zedong", "Deng Xiaoping",
    "Sun Yat-sen", "Haile Selassie", "Ramesses II", "Tutankhamun", "Hatshepsut",
    "Otto von Habsburg",
    # Artistes / musiciens
    "Leonardo da Vinci", "Michelangelo", "Pablo Picasso", "Vincent van Gogh", "Salvador Dalí",
    "Frida Kahlo", "Ludwig van Beethoven", "Wolfgang Amadeus Mozart", "Johann Sebastian Bach",
    "Elvis Presley", "John Lennon", "Bob Marley", "Michael Jackson", "Freddie Mercury",
    "Édith Piaf", "Claude Monet", "Rembrandt", "Andy Warhol", "Georgia O'Keeffe",
    "Gustav Klimt", "Edvard Munch", "David Bowie", "Prince (musician)", "Whitney Houston",
    "Johannes Vermeer", "Henri Matisse", "Auguste Rodin", "Piet Mondrian", "Jean-Michel Basquiat",
    # Explorateurs
    "Christopher Columbus", "Marco Polo", "Neil Armstrong", "Amelia Earhart",
    "Ferdinand Magellan", "James Cook", "Ibn Battuta", "Roald Amundsen", "Zheng He",
    "Vasco da Gama",
    # Militants / figures civiques
    "Martin Luther King Jr.", "Malcolm X", "Rosa Parks", "Malala Yousafzai",
    "Greta Thunberg", "Desmond Tutu", "Aung San Suu Kyi", "César Chávez",
    "Wangari Maathai", "Harvey Milk",
    # Entrepreneurs
    "Steve Jobs", "Bill Gates", "Elon Musk", "Mark Zuckerberg", "Jeff Bezos",
    "Henry Ford", "Walt Disney", "Coco Chanel", "Warren Buffett", "Oprah Winfrey",
    # Acteurs / artistes du spectacle
    "Charlie Chaplin", "Marilyn Monroe", "Bruce Lee", "Audrey Hepburn", "Alfred Hitchcock",
    "Grace Kelly", "Louis de Funès", "Jean-Paul Belmondo", "Gérard Depardieu",
    "Catherine Deneuve",
    # Athlètes
    "Muhammad Ali", "Pelé", "Usain Bolt", "Serena Williams", "Diego Maradona",
    "Michael Jordan", "Zinedine Zidane", "Lionel Messi", "Cristiano Ronaldo",
    "Roger Federer", "Simone Biles", "Michael Phelps", "Jesse Owens", "Babe Ruth",
    "Wayne Gretzky",
    # Figures religieuses / historiques
    "Gautama Buddha", "Joan of Arc", "Che Guevara", "Moses", "Martin Luther",
    "Thomas Aquinas",
]


def slugify(name):
    s = name.lower()
    s = re.sub(r"[()]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip('-')


def get_with_retry(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.read() if binary else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = int(e.headers.get('Retry-After', 0)) or (5 * (attempt + 1))
                print(f'  429, attente {wait}s...')
                time.sleep(wait)
                continue
            raise
    raise RuntimeError('429 persistant après plusieurs tentatives')


def fetch_thumb_url(title):
    url = ('https://en.wikipedia.org/w/api.php?action=query&titles=' +
           urllib.parse.quote(title) +
           '&prop=pageimages&pithumbsize=500&format=json')
    data = get_with_retry(url)
    pages = data.get('query', {}).get('pages', {})
    for p in pages.values():
        thumb = p.get('thumbnail', {}).get('source')
        if thumb:
            return thumb
    return None


def main():
    manifest = []
    seen = set()
    ok, fail = 0, 0
    for name in NAMES:
        slug = slugify(name)
        if slug in seen:
            continue
        seen.add(slug)
        out_path = os.path.join(OUT_DIR, slug + '.jpg')
        if os.path.exists(out_path):
            manifest.append({'slug': slug, 'name': name})
            ok += 1
            continue
        try:
            thumb = fetch_thumb_url(name)
            if not thumb:
                print('SKIP (pas de portrait) :', name)
                fail += 1
                continue
            img = get_with_retry(thumb, binary=True)
            with open(out_path, 'wb') as f:
                f.write(img)
            manifest.append({'slug': slug, 'name': name})
            ok += 1
            print('OK', name)
        except Exception as e:
            print('ERREUR', name, '->', e)
            fail += 1
        time.sleep(0.4)  # poli envers l'API
    with open(os.path.join(OUT_DIR, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f'OK: {ok} portraits téléchargés, {fail} échecs, manifest.json écrit ({len(manifest)} entrées)')


if __name__ == '__main__':
    main()
