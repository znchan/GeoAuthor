import json
import torch


def parse_text_to_mapbackground(input_text: str, model, tokenizer):
    prompt = """Role: You are an expert of GIS and geographic articles. Your sole purpose is to analyze the input text and determine which map background is most suitable if a map visualization is needed as an illustration for this text.
    There are four types of map backgrounds to choose from: standard map, satellite map, traffic map, dark mode map. Below are the articles that best suit them.
    【Standard Map】This type of map is suitable for articles discussing topics such as administrative divisions, urban planning, transportation networks, and population distribution. It clearly displays basic geographical information such as roads, boundaries, and place names, making it suitable for content requiring accurate location and route analysis. Examples include discussions of urban development, regional economies, and political geography.
    【Satellite Map】Ideal for articles related to physical geography, environmental science, and land use. Realistic surface images can visually demonstrate topography, vegetation cover, water distribution, and urban-rural differences. Particularly suitable for discussions on topics such as the ecological environment, agricultural distribution, natural disasters, and the impacts of climate change.
    【Traffic Map】These maps are specifically designed for articles related to transportation, urban congestion, and logistics. They highlight traffic flow, road conditions, and congestion, making them suitable for analyzing traffic problems, traffic optimization in urban planning, and business site selection.
    【Dark Mode Map】Suitable for articles that need to highlight specific data points or heat maps. Dark backgrounds make colored data markers stand out more, and are often used to display content that requires data visualization, such as the nighttime economy, light pollution distribution, crime statistics, and population density heat maps.
    Please note that you can only choose one of the four types. If you feel that the text content does not quite match any of these four map descriptions, then you can choose Standard Map by default.
    Text to Analyze:""" + input_text + """
Output:"""
    # print(prompt)

    messages = [
        {"role": "user", "content": prompt}
    ]
    
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    response = tokenizer.decode(generated_ids[0][len(model_inputs.input_ids[0]):], skip_special_tokens=True)
    return response
    


def parse_text_to_mapscope(input_text: str, model, tokenizer):
    prompt = """Analyze the following geography-related text and determine the most appropriate map display range.

Text content:
[Insert text to be analyzed here]

Please output the result in the following JSON format:
{
  "primary_region": "Standard name of the primary geographic region",
  "scope_level": "Display range level", 
  "reasoning": "Brief explanation for choosing this range"
}

Available options for scope_level:
- "global" (entire world)
- "continent" (e.g., North America, Europe, Asia)
- "country" (e.g., United States, China, Germany)
- "state_province" (e.g., California, Texas, Ontario)
- "city_metro" (e.g., New York City area, London metro)
- "local" (neighborhood or district level)

Guidelines:
1. Choose the smallest geographic scope that meaningfully includes all major locations mentioned
2. If the text discusses multiple scattered locations, choose a scope that encompasses them all
3. Consider the main theme - policy analysis usually needs country/state level, urban planning needs city level
4. For comparative analysis between regions, choose the level that includes all compared areas

Example:
If text discusses voting patterns in California, Texas, and Florida, output:
{
  "primary_region": "United States",
  "scope_level": "country",
  "reasoning": "Analysis covers multiple U.S. states requiring national-level view"
}
    Text to Analyze:""" + input_text + """
Output:"""
    # print(prompt)

    messages = [
        {"role": "user", "content": prompt}
    ]
    
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    response = tokenizer.decode(generated_ids[0][len(model_inputs.input_ids[0]):], skip_special_tokens=True)
    return response




def parse_text_to_POINT(input_text: str, model, tokenizer):

    prompt = """Role: You are a precise GIS data extraction engine. Your sole purpose is to analyze the input text and identify ALL descriptions that can be visualized as POINT features on a map. Your output must be a strictly formatted JSON.

1. POINT Type Definitions 
You must categorize any POINT feature into one of the following three types. A single text may contain multiple instances of each type.

• "dot": The locations described in the text are sized to be described in points rather than to the extent of a area. In other words, these are point locations that should be visualized as dots, and these are specific locations that don't have significant area extent.
JSON Requirements:
"content": the place name (strings) of the dot;
"visualEncoding": Object containing "color" and "size";


• "marker": The locations described in the text are sized to be described in points rather than to the extent of a area. As for when to use "dot" and "marker", it depends on the specific scene. You can infer from the context whether using "dot" or "marker" for visualization is more appropriate. Generally, important point locations that should be visualized as markers; these are significant landmarks or major attractions.
Key Indicator Words: "iconic", "famous", "main", "central", "important landmark".
Text Examples: "Our first day in Tokyo began at the iconic Senso-ji Temple", "We visited the famous Eiffel Tower", "The main cathedral dominates the city skyline", "Central Station is the transportation hub", "The visitor center provides tourist information".
JSON Requirements:
"content": the place name (strings) of the marker;
"visualEncoding": Object containing "color" and "size";


• "other icon": This special type is only suitable when both the "dot" and "marker" types are not appropriate, and the text indicates the use of other types of icons to represent a certain location in the image.
JSON Requirements:
"content": the place name (strings) of the icon;


2. Examples
Example 1 Text: "Our first day in Tokyo began at the iconic Senso-ji Temple,Tokyo's oldest Buddhist temple. The vibrant Nakamise shopping street leading up to the temple was bustling withtourists and locals alike, offering a variety of traditional snacks and souvenirs. After lunch, we headed to Akihabara, the electronics and anime mecca of Tokyo. We explored several multi-story electronics stores and visited a maidcafe for a unique cultural experience. In the evening, we drove through the vicinity of the Imperial Palace and saw it, and finally arrived at Odaiba, a large artificial island inTokyo Bay, where we enjoyed the futuristic architecture. We started our second day in the fabulous and charming neighborhood of Nakameguro. We took a leisurely morning stroll along the Meguro River, admiring the cherry trees lining its banks. The hip cafes and boutiques of the area provided a relaxing start to our day. In the afternoon, we headed to the lively Shibuya district that famous for its busy pedestrian crossing. We also paid our respects at the statueof Hachiko, the loyal dog, and indulged in some shopping atthe trendy department stores that Shibuya is known for. As the day progressed, we made our way to Shinjuku for ourfinal stop. Finally we arrived at the Tokyo Metropolitan Government Building. The free observation decks offered usbreathtaking panoramic views of the city and the twinkling lights of Tokyo at dusk provided a fitting end to our exciting day of exploration."
Expected JSON Output: 
"marker": [
    {
    "id": 1,
    "content": "Senso-ji Temple",
    "visualEncoding": {"color": "blue", "size": 1}
    },
    {
    "id": 2,
    "content": "the Tokyo Metropolitan Government Building",
    "visualEncoding": {"color": "blue", "size": 1}
    }
]


Example 2 Text: Our hotel, West Lake State Guesthouse, is located in the vast West Lake scenic area. The scenery here is picturesque, so peaceful, like a paradise on earth. We can gradually walk west from here and climb up the mountain. At the top of the mountain, you can see the Hangzhou Meteorological Station.
Expected JSON Output: 
"dot": [
    {
    "id": 1,
    "content": "West Lake State Guesthouse",
    "visualEncoding": {"color": "green", "size": 1}
    },
    {
    "id": 2,
    "content": "the Hangzhou Meteorological Station",
    "visualEncoding": {"color": "blue", "size": 1}
    }
]


Example 3 Text: Beijing is the capital of China, and we use a five pointed star icon to indicate it in the figure.
Expected JSON Output: 
"other icon": [
    {
        "id": 1,
        "content": "Beijing",
    }
]



3. Note
[Note 1] Not all place names mentioned in the text are included in the POINT type. Compliant with the POINT type, including "dot", "marker", and "other icon", it should be presented in the form of points on the map. These are specific locations and do not have a significant area range.

[Note 2] Place names whose exact location cannot be determined (the exact latitude and longitude cannot be determined based on this place name), including general and imprecise statements like "a nearby coffee shop" and "a restaurant", are not included in the results. There are also duplicate expressions; for example, "Lingyin Temple" has already been selected, so "the ancient Lingyin Temple" should not be selected again, as these expressions essentially refer to the same place.


4. Output Format
Your output must be a valid JSON of objects like the following format:
{
"marker": [
    {
    "id": 1,
    "content": "Senso-ji Temple",
    "visualEncoding": {"color": "blue", "size": 1}
    },
    {
    "id": 2,
    "content": "the Tokyo Metropolitan Government Building",
    "visualEncoding": {"color": "blue", "size": 1}
    }
],
"dot": [
    {
    "id": 1,
    "content": "West Lake State Guesthouse",
    "visualEncoding": {"color": "red", "size": 1}
    },
    {
    "id": 2,
    "content": "Hangzhou East Railway Station",
    "visualEncoding": {"color": "red", "size": 1}
    }
],
"other icon": [
    {
        "id": 1,
        "content": "Beijing",
    }
]
}


If the given text doesn't have a "dot" or "other icon" but have "marker", the output JSON may be:
{
"marker": [
    {
    "id": 1,
    "content": "Senso-ji Temple",
    "visualEncoding": {"color": "blue", "size": 1}
    },
    {
    "id": 2,
    "content": "the Tokyo Metropolitan Government Building",
    "visualEncoding": {"color": "blue", "size": 1}
    }
],
"dot": [],
"other icon": []
}



However, if you don't find a "dot"/"marker"/"other icon" in the given text (i.e., the values ​​of the various visual attributes are empty), you just need to set a empty JSON value for the corresponding item, just like the following format, and no explanation is needed. No explanation is needed and just output the following:
{
"marker": [],
"dot": [],
"other icon": []
}



5. About "visualEncoding" object
Moreover, the "visualEncoding" object should have sensible defaults if not specified in the text. You can assign values based on common sense or text sentiment.

However, if the visualEncoding method is specified in the text, please clearly state the source of the text in the "visualEncoding" value. For example, if the text mentions "Lingyin Temple and the Gate of Hangzhou are both important city landmarks, representing ancient and modern styles respectively, which we have marked with red dots in the map. Today, we are carrying the five-star red flag to visit these landmarks." then your JSON output might look like this: 
{
"marker": [],
"dot": [
    {
    "id": 1,
    "content": "Lingyin Temple",
    "visualEncoding": {"color": "red", "size": 1, "position": "which we have marked with red dots in the map"}
    },
    {
    "id": 2,
    "content": "the Gate of Hangzhou",
    "visualEncoding": {"color": "red", "size": 1, "position": "which we have marked with red dots in the map."}
    }
],
"other icon": []
}
In other words, a new field "position" is added to the value of "visualEncoding". The value of "position" is a middle sentence excerpted from the original text, containing the word of the source of color ("red" in this example). This allows us to determine the specific location in the original text. In this example, although "red" appears twice in the article ("which we have marked with red dots in the map" and "we are carrying the five-star red flag to visit these landmarks"), the visualEncoding is clearly from "which we have marked with red dots in the map", therefore "position": "which we have marked with red dots in the map".



6. Your Task
Analyze the following text and generate the corresponding JSON output for POINT features.
Text to Analyze: """ + input_text + """
Output:"""
    

    # print(prompt)

    messages = [
        {"role": "user", "content": prompt}
    ]
    
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    # 解码响应
    response = tokenizer.decode(generated_ids[0][len(model_inputs.input_ids[0]):], skip_special_tokens=True)

    return response
    



def parse_text_to_LINE(input_text: str, model, tokenizer):
    
    prompt = """Role: You are a precise GIS data extraction engine. Your sole purpose is to analyze the input text and identify ALL descriptions that can be visualized as LINE features on a map. Your output must be a strictly formatted JSON.

1. LINE Type Definitions 
You must categorize any LINE feature into one of the following three types. A single text may contain multiple instances of each type.

• "trajectory": A path defined by a sequence of specific points (toponyms) mentioned in order. The focus is on the journey and the stops along the way.
Key Indicator Words: "from A to B to C", "via", "passed", "journey", "route", "itinerary", "sequence of stops".
JSON Requirements:
"id": a unique number for each trajectory;
"name": A unique identifier for this trajectory (e.g., "trajectory 1");
"sequence": An ordered array of place names (strings) of the trajectory;
"visualEncoding": Object containing "color", "strokeWidth", "style", and "display form";

• "line": A named linear geographic feature that can be directly fetched by its name from a spatial database (e.g., OpenStreetMap).
Key Indicator Words: "the Yangtze River", "the Great Wall", "G4 Highway", "the equator", "the Silk Road".
JSON Requirements:
"id": a unique number for each line;
"name": A unique identifier for this line (e.g., "line 1");
"content": the place name (strings) of the line;
"visualEncoding": Object containing "color" and "strokeWidth";

• "direction": An arrow indicating a general direction or movement between two locations, not a precise path.
Key Indicator Words: "from north to south", "towards the capital", "expansion into the region", "movement from A to B", "influx", "exodus".
JSON Requirements:
"id": a unique number for each direction;
"name": A unique identifier for this direction (e.g., "direction 1");
"from": The origin area or point (string);
"to": The destination area or point (string);
"visualEncoding": Object containing "color" and "strokeWidth";


2. Examples
Example 1 Text: "Our first day in Tokyo began at the iconic Senso-ji Temple,Tokyo's oldest Buddhist temple. The vibrant Nakamise shopping street leading up to the temple was bustling withtourists and locals alike, offering a variety of traditional snacks and souvenirs. After lunch, we headed to Akihabara, the electronics and anime mecca of Tokyo. We explored several multi-story electronics stores and visited a maidcafe for a unique cultural experience. In the evening, we drove through the vicinity of the Imperial Palace and saw it, and finally arrived at Odaiba, a large artificial island inTokyo Bay, where we enjoyed the futuristic architecture. We started our second day in the fabulous and charming neighborhood of Nakameguro. We took a leisurely morning stroll along the Meguro River, admiring the cherry trees lining its banks. The hip cafes and boutiques of the area provided a relaxing start to our day. In the afternoon, we headed to the lively Shibuya district that famous for its busy pedestrian crossing. We also paid our respects at the statueof Hachiko, the loyal dog, and indulged in some shopping atthe trendy department stores that Shibuya is known for. As the day progressed, we made our way to Shinjuku for ourfinal stop. Finally we arrived at the Tokyo Metropolitan Government Building. The free observation decks offered usbreathtaking panoramic views of the city and the twinkling lights of Tokyo at dusk provided a fitting end to our exciting day of exploration."
Expected JSON output: 
"trajectory": [
{
"id": 1,
"name": "trajectory 1",
"sequence": ["Senso-ji Temple", "Akihabara", "Imperial Palace", "Odaiba"],
"visualEncoding": {"color": "pink", "strokeWidth": "1", "style": "solid"}
},
{
"id": 2,
"name": "trajectory 2",
"sequence": ["Nakameguro", "Meguro River", "Shibuya district", "Tokyo Metropolitan Government Building"],
"visualEncoding": {"color": "green", "strokeWidth": "1", "style": "solid"}
}
]





Example 2 Text: "第一天清晨，我们从苏州站出发，开始了这场园林探访之旅。首站来到苏州博物馆，在贝聿铭设计的现代建筑中感受古今交融的魅力。随后步行前往拙政园，这座苏州最大的古典园林让我们流连忘返。午后，我们继续探访了狮子林，那些奇特的太湖石仿佛一座座迷宫。傍晚时分，我们先后游览了耦园和网师园，在小巧精致的布局中体会江南园林的诗意。
第二天的行程同样充实。我们从沧浪亭开始，这座以山石为主景的园林别有一番风味。接着参观了可园和恰园，感受不同园林的造园手法。下午，环秀山庄的假山堆叠技艺令人赞叹，艺圃的简朴雅致也让我们印象深刻。旅程的最后一站是留园，这座与拙政园齐名的园林为我们的苏州之行画上了完美的句号。傍晚，我们从苏州站踏上归程，带着满满的回忆离开了这座园林之城。"
Expected JSON output: 
"trajectory": [
{
"id": 1,
"name": "trajectory 1",
"sequence": ["苏州站", "苏州博物馆", "拙政园", "狮子林", "耦园", "网师园"],
"visualEncoding": {"color": "pink", "strokeWidth": "1", "style": "solid"}
},
{
"id": 2,
"name": "trajectory 2",
"sequence": ["沧浪亭", "可园", "恰园", "环秀山庄", "艺圃", "留园", "苏州站"],
"visualEncoding": {"color": "green", "strokeWidth": "1", "style": "solid"}
}
]





Example 3 Text: "China has many iconic landmarks, such as the Great Wall, the Yangtze River, and the Yellow River, which are all imprints of the Chinese nation."
Expected JSON Output:
"line": [
    {
    "id": 1,
    "name": "line 1",
    "content": "Great Wall",
    "visualEncoding": {"color": "green", "opacity": 1}
    },
    {
    "id": 2,
    "name": "line 2",
    "content": "the Yangtze River",
    "visualEncoding": {"color": "blue", "opacity": 1}
    },
    {
    "id": 3,
    "name": "line 3",
    "content": "the Yellow River",
    "visualEncoding": {"color": "yellow", "opacity": 1}
    }
]


Example 4 Text: "Standing on Tianmu Mountain, I gazed at the Xixi Wetland in the distance, and the scenery was so beautiful!"
Expected JSON Output:
"direction": [
{
"id": 1,
"name": "direction 1",
"from": "Tianmu Mountain",
"to": "the Xixi Wetland",
"visualEncoding": {"color": "green", "strokeWidth": "1"}
}
]



3. Note
[Note 1] Please note the distinction between "direction" and "trajectory": "trajectory" generally refers to the travel or movement trajectory of people or things, while "direction" specifically refers to looking from one place to another, or emphasizing a direction in the text (rather than the movement trajectory). 

[Note 2] The selection of "direction" is very strict. Do not simply regard the movement trajectory of the article as "direction". Only when the text explicitly mentions the location from which one location is being viewed, or specifically emphasizes the keyword "direction" from one location to another, can it be considered a "direction." You can only determine it as a "direction" if you clearly capture the aforementioned keywords or equivalent meaning. Therefore, "direction" is rare; never arbitrarily use a portion of a movement or travel route described in the text as a "direction"!

[Note 3] Selection of place names in "trajectory" or other types: If the exact location cannot be determined (i.e., the exact latitude and longitude cannot be determined based on this place name), including general and imprecise statements like "a nearby coffee shop", "a restaurant", and "city ​​center", they are not included in the results. 



4. Output Format Instructions
Your output must be a valid JSON of objects like the following format:
{
"trajectory": [
{
"id": 1,
"name": "trajectory 1",
"sequence": ["Senso-ji Temple", "Akihabara", "Imperial Palace", "Odaiba"],
"visualEncoding": {"color": "pink", "strokeWidth": "1", "style": "solid"}
},
{
"id": 2,
"name": "trajectory 2",
"sequence": ["Nakameguro", "Meguro River", "Shibuya district", "Tokyo Metropolitan Government Building"],
"visualEncoding": {"color": "green", "strokeWidth": "1", "style": "solid"}
}
],
"line": [
    {
    "id": 1,
    "name": "line 1",
    "content": "Great Wall",
    "visualEncoding": {"color": "green", "opacity": 1}
    },
    {
    "id": 2,
    "name": "line 2",
    "content": "the Yangtze River",
    "visualEncoding": {"color": "blue", "opacity": 1}
    },
    {
    "id": 3,
    "name": "line 3",
    "content": "the Yellow River",
    "visualEncoding": {"color": "yellow", "opacity": 1}
    }
],
"direction": [
{
"id": 1,
"name": "direction 1",
"from": "Tianmu Mountain",
"to": "the Xixi Wetland",
"visualEncoding": {"color": "green", "strokeWidth": "1"}
}
]
}

However, if you don't find a trajectory/line/direction in the given text, you just need to set a empty JSON or array (empty array for "trajectory" and "direction"; ampty JSON for "line") for the corresponding item. For example, if the given text doesn't have a "trajectory" but have "line" and "direction", the output JSON may be:
{
"trajectory": [],
"line": [
    {
    "id": 1,
    "name": "line 1",
    "content": "Great Wall",
    "visualEncoding": {"color": "green", "opacity": 1}
    },
    {
    "id": 2,
    "name": "line 2",
    "content": "the Yangtze River",
    "visualEncoding": {"color": "blue", "opacity": 1}
    },
    {
    "id": 3,
    "name": "line 3",
    "content": "the Yellow River",
    "visualEncoding": {"color": "yellow", "opacity": 1}
    }
],
"direction": [
{
"id": 1,
"name": "direction 1",
"from": "Tianmu Mountain",
"to": "the Xixi Wetland",
"visualEncoding": {"color": "green", "strokeWidth": "1"}
}
]
}
For example, if the given text doesn't have a "line" and "trajectory" but have "direction", the output JSON may be:
{
"trajectory": [],
"line": [],
"direction": [
{
"id": 1,
"name": "direction 1",
"from": "Tianmu Mountain",
"to": "the Xixi Wetland",
"visualEncoding": {"color": "green", "strokeWidth": "1"}
}
]
}


Remember, even if the values ​​of the various visual attributes are empty, no explanation is needed. Only the results in JSON format can be output:
{
"trajectory": [],
"line": [],
"direction": []
}




5. About "visualEncoding" object
Moreover, the "visualEncoding" object should have sensible defaults if not specified in the text. You can assign values based on common sense or text sentiment.

However, if the visualEncoding method is specified in the text, please clearly state the source of the text in the "visualEncoding" value. For example, if the text mentions "Our tour route today starts from the West Lake State Guesthouse, first visiting Xixi Wetland Park, where there are many pink water birds, and finally visiting the Liangzhu Site. This route is highlighted in pink on the map." then your JSON output might look like this: 
{
"trajectory": [
{
"id": 1,
"name": "trajectory 1",
"sequence": ["the West Lake State Guesthouse", "Xixi Wetland Park", "Liangzhu Site"],
"visualEncoding": {"color": "pink", "position": "This route is highlighted in pink on the map", "strokeWidth": "1", "style": "solid"}
}
],
"line": [],
"direction": []
}
In other words, a new field "position" is added to the value of "visualEncoding". The value of "position" is a middle sentence excerpted from the original text, containing the word of the source of color ("pink" in this example). This allows us to determine the specific location in the original text. In this example, although "pink" appears twice in the article ("where there are many pink water birds" and "This route is highlighted in pink on the map"), the visualEncoding is clearly from "This route is highlighted in pink on the map", therefore "position": "This route is highlighted in pink on the map".


6. Your Task
Analyze the following text and generate the corresponding JSON output for LINE features without any further interpretation.
Text to Analyze: """ + input_text + """
Output:"""
    

    # print(prompt)

    messages = [
        {"role": "user", "content": prompt}
    ]
    
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    response = tokenizer.decode(generated_ids[0][len(model_inputs.input_ids[0]):], skip_special_tokens=True)

    return response
    



def parse_text_to_AREA(input_text: str, model, tokenizer):
    
    prompt = """Role: You are a precise GIS data extraction engine. Your sole purpose is to analyze the input text and identify ALL descriptions that can be visualized as AREA features on a map. Your output must be a strictly formatted JSON.

1. AREA Type Definitions 
You must categorize any AREA feature into one of the following three types. A single text may contain multiple instances of each type.

• "regular shape": The area described in the text can or needs to be visualized as a regular shape, such as a circle, polygon, etc.
JSON Requirements:
"type": What specific regular shape is it, for example, circular or polygonal;
"visualEncoding": Object containing color", "radius"("length" and "width", if rectangle);

• "irregular area": A more common type of visualization is that most of the regions and place names mentioned in the text can and need to be visualized in this way, such as a country, a region, or an area. In short, it is an irregular (not a regular shape such as a circle or rectangle) area that can be highlighted on the map.
【Note 1】: Some place names from the input text cannot be considered as AREA types, but should be represented as a point on the map, such as precise location points and extremely small place names (which cannot be drawn as a range or area on the map, but should be represented as a point). Place names like these do not need to be included in the JSON output. Overall, "irregular area" should refer to place names that have significant area extent drawn on a map, rather than being represented as points.
【Note 2】: Place names whose exact location cannot be determined (i.e., it is impossible to draw an accurate region based on this), including general and imprecise statements like "a nearby lake" and "a restaurant", are not included in the results. There are also duplicate expressions; for example, "West Lake" has already been selected, so "the beautiful West Lake" should not be selected again, as these expressions essentially refer to the same place.
JSON Requirements:
"content": The name of areas to be drawn;
"visualEncoding": Object containing "color";


2. Examples
Example 1 Text: "Our first day in Tokyo began at the iconic Senso-ji Temple,Tokyo's oldest Buddhist temple. The vibrant Nakamise shopping street leading up to the temple was bustling withtourists and locals alike, offering a variety of traditional snacks and souvenirs. After lunch, we headed to Akihabara, the electronics and anime mecca of Tokyo. We explored several multi-story electronics stores and visited a maidcafe for a unique cultural experience. In the evening, we drove through the vicinity of the Imperial Palace and saw it, and finally arrived at Odaiba, a large artificial island inTokyo Bay, where we enjoyed the futuristic architecture. We started our second day in the fabulous and charming neighborhood of Nakameguro. We took a leisurely morning stroll along the Meguro River, admiring the cherry trees lining its banks. The hip cafes and boutiques of the area provided a relaxing start to our day. In the afternoon, we headed to the lively Shibuya district that famous for its busy pedestrian crossing. We also paid our respects at the statueof Hachiko, the loyal dog, and indulged in some shopping atthe trendy department stores that Shibuya is known for. As the day progressed, we made our way to Shinjuku for ourfinal stop. Finally we arrived at the Tokyo Metropolitan Government Building. The free observation decks offered usbreathtaking panoramic views of the city and the twinkling lights of Tokyo at dusk provided a fitting end to our exciting day of exploration."
Expected JSON Output: 
{
"regular shape": [],
"irregular area": [
    {
        "id": 1,
        "name": "region 1",
        "content": "Imperial Palace",
        "visualEncoding": {"color": "pink", "opacity": 0.5}
    },
    {
        "id": 2,
        "name": "region 2",
        "content": "Odaiba",
        "visualEncoding": {"color": "pink", "opacity": 0.5}
    }
]
}


Example 2 Text: "The latest election results show a shifting political landscape across the United States. Republicans secured victories in Iowa, Arkansas, Alabama, and New Hampshire, consolidating their support in these key states. Meanwhile, Democrats claimed wins in Oregon, Arizona, New Mexico, Kansas, Michigan, Virginia, New York, New Jersey, Massachusetts, and Maine, demonstrating their expanded influence across both coastal and traditionally competitive regions. These results reflect the evolving partisan divide as both parties prepare for the upcoming electoral battles."
Expected JSON Output: 
{
"regular shape": [],
"irregular area": [
    {
        "id": 1,
        "name": "region 1",
        "content": "Iowa",
        "visualEncoding": {"color": "pink", "opacity": 0.5}
    },
    {
        "id": 2,
        "name": "region 2",
        "content": "Arkansas",
        "visualEncoding": {"color": "pink", "opacity": 0.5}
    },
    {
        "id": 3,
        "name": "region 3",
        "content": "Alabama",
        "visualEncoding": {"color": "pink", "opacity": 0.5}
    },
    {
        "id": 4,
        "name": "region 4",
        "content": "New Hampshire",
        "visualEncoding": {"color": "pink", "opacity": 0.5}
    },
    {
        "id": 5,
        "name": "region 5",
        "content": "Oregon",
        "visualEncoding": {"color": "purple", "opacity": 0.5}
    },
    {
        "id": 6,
        "name": "region 6",
        "content": "Arizona",
        "visualEncoding": {"color": "purple", "opacity": 0.5}
    },
    {
        "id": 7,
        "name": "region 7",
        "content": "New Mexico",
        "visualEncoding": {"color": "purple", "opacity": 0.5}
    },
    {
        "id": 8,
        "name": "region 8",
        "content": "Kansas",
        "visualEncoding": {"color": "purple", "opacity": 0.5}
    },
    {
        "id": 9,
        "name": "region 9",
        "content": "Michigan",
        "visualEncoding": {"color": "purple", "opacity": 0.5}
    },
    {
        "id": 10,
        "name": "region 10",
        "content": "Virginia",
        "visualEncoding": {"color": "purple", "opacity": 0.5}
    },
    {
        "id": 11,
        "name": "region 11",
        "content": "New York",
        "visualEncoding": {"color": "purple", "opacity": 0.5}
    },
    {
        "id": 12,
        "name": "region 12",
        "content": "New Jersey",
        "visualEncoding": {"color": "purple", "opacity": 0.5}
    },
    {
        "id": 13,
        "name": "region 13",
        "content": "Massachusetts",
        "visualEncoding": {"color": "purple", "opacity": 0.5}
    },
    {
        "id": 14,
        "name": "region 14",
        "content": "Maine",
        "visualEncoding": {"color": "purple", "opacity": 0.5}
    }
]
}





Example 3 Text: "Hangzhou has strict height restrictions, such as a 5km radius around Xixi Wetland, a 10km radius around West Lake Scenic Area, and a 15km radius around Xiaoshan Airport."
Expected JSON Output: 
{
"irregular area": [],
"regular shape": [
{
"id": 1,
"type": "circle",
"center": "Xixi Wetland",
"radius": 5,
"visualEncoding": {"color": "pink", "opacity": 0.5}
},
{
"id": 2,
"type": "circle",
"center": "West Lake Scenic Area",
"radius": 10,
"visualEncoding": {"color": "pink", "opacity": 0.5}
},
{
"id": 3,
"type": "circle",
"center": "Xiaoshan Airport",
"radius": 15,
"visualEncoding": {"color": "pink", "opacity": 0.5}
}
]
}


Example 4 Text: "The polygonal area formed by Hangzhou Olympic Sports Center, Gongchen Bridge, Hangzhou West Station, and Tongjian Lake is the core urban area."
Expected JSON Output: 
{
"irregular area": [],
"regular shape": [
{
"id": 1,
"type": "polygon",
"vertex": ["Hangzhou Olympic Sports Center", "Gongchen Bridge", "Hangzhou West Station", "Tongjian Lake"],
"visualEncoding": {"color": "pink", "opacity": 0.5}
},
]
}



3. Output Format Instructions
Your output must be a valid JSON of objects like the following format:
{
"regular shape": [
{
"id": 1,
"type": "circle",
"center": "Xixi Wetland",
"radius": 5,
"visualEncoding": {"color": "pink", "opacity": 0.5}
},
{
"id": 2,
"type": "circle",
"center": "West Lake Scenic Area",
"radius": 10,
"visualEncoding": {"color": "pink", "opacity": 0.5}
},
{
"id": 3,
"type": "circle",
"center": "Xiaoshan Airport",
"radius": 15,
"visualEncoding": {"color": "pink", "opacity": 0.5}
}
],
"irregular area": [
    {
        "id": 1,
        "name": "region 1",
        "content": "Imperial Palace",
        "visualEncoding": {"color": "pink", "opacity": 0.5}
    },
    {
        "id": 2,
        "name": "region 2"
        "content": "Odaiba",
        "visualEncoding": {"color": "pink", "opacity": 0.5}
    }
]
}



Remember, even if the values ​​of the various visual attributes are empty (i.e., you don't find a "regular shape"/"irregular area" in the given text), no explanation is needed. Only the results in JSON format can be output and you should set a empty JSON value for the corresponding item. No explanation is needed; No explanation is needed; No explanation is needed; Only output:
{
"irregular area": [],
"regular shape": []
}




4. About "visualEncoding" object
Moreover, the "visualEncoding" object should have sensible defaults if not specified in the text. You can assign values based on common sense or text sentiment.
However, if the visualEncoding method is specified in the text, please clearly state the source of the text in the "visualEncoding" value. For example, if the text mentions "Xixi Wetland is very beautiful and is an important green lung for the city. We use a green area to represent it in the picture." then your JSON output might look like this: 
{
"regular shape": [],
"irregular area": [
    {
        "id": 1,
        "name": "region 1",
        "content": "Xixi Wetland",
        "visualEncoding": {"color": "green", "opacity": 0.5, "position": "We use a green area to represent it in the picture"}
    }
]
}
In other words, a new field "position" is added to the value of "visualEncoding". The value of "position" is a middle sentence excerpted from the original text, containing the word of the source of color ("green" in this example). This allows us to determine the specific location in the original text. In this example, although "green" appears twice in the article ("is an important green lung for the city" and "We use a green area to represent it in the picture"), the visualEncoding is clearly from "We use a green area to represent it in the picture", therefore "position": "We use a green area to represent it in the picture".



5. Your Task
Analyze the following text and generate the corresponding JSON output for AREA features.
Text to Analyze: """ + input_text + """
Output:"""
    

    # print(prompt)

    messages = [
        {"role": "user", "content": prompt}
    ]
    
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    response = tokenizer.decode(generated_ids[0][len(model_inputs.input_ids[0]):], skip_special_tokens=True)

    return response






def generate_explanatory_text(input_text: str, json_result, model, tokenizer):
    prompt = """Role: You are an expert in geographical articles and geographical visualizations. There is now a system that generates geographic visualizations from geographic text. Users input geographic text, and the system parses it into a JSON representation, which can then be used to create visualizations. However, the interface users see only presents geographical articles, while the JSON is stored on the system backend. Therefore, I need you to add explanatory text to each non-empty item in the JSON (this explanatory text will be displayed on the front-end interface for users to see), explaining how the visualization was drawn. This way, users can understand how the visualization was created by reading the explanatory text.
    Now, given the JSON content generated from the geographical text, the JSON abstracts the visual elements in the text, preparing for subsequent geographic visualization of the text. The JSON categorizes geographic elements into the following classes: "dot", "marker", "other icon", "trajectory", "line", "direction", "irregular area", and "regular shape". Of course, not every text contains all eight of these geographic elements, so the value of an element in JSON can be empty. What you need to do is generate explanatory text on how to draw a visualization of each non-empty geographic element in a given JSON.



1. Examples
【Example 1】

Given JSON:
{
    "dot": {},
    "other icon": {},
    "direction": [],
    "line": {},
    "marker": {
        "content": [
            "Senso-ji Temple",
            "Imperial Palace",
            "Hachiko statue",
            "Tokyo Metropolitan Government Building"
        ]
    },    
    "trajectory": [
        {
            "id": 1,
            "name": "trajectory 1",
            "sequence": [
                "Senso-ji Temple",
                "Akihabara",
                "Imperial Palace",
                "Odaiba"
            ],
            "visualEncoding": {
                "color": "pink",
                "strokeWidth": "1",
                "style": "solid"
            }
        },
        {
            "id": 2,
            "name": "trajectory 2",
            "sequence": [
                "Nakameguro",
                "Meguro River",
                "Shibuya district",
                "Tokyo Metropolitan Government Building"
            ],
            "visualEncoding": {
                "color": "green",
                "strokeWidth": "1",
                "style": "solid"
            }
        }
    ],
    "irregular area": {},
    "regular shape": []
}


Then you need to provide explanatory text based on the given JSON, explaining how each type of element will be drawn on the map. 
In this example, you can output:
{
    "dot": "",
    "other icon": "",
    "direction": "",
    "line": "",
    "marker": "Use markers to mark the four locations Senso-ji Temple, Imperial Palace, Hachiko statue, Tokyo Metropolitan Government Building",
    "trajectory": "Draw two trajectory: Trajectory 1 is connecting Senso-ji Temple, Akihabara, Imperial Palace, and Odaiba.\nTrajectory 2 is connecting Nakameguro, Meguro River, Shibuya district, and Tokyo Metropolitan Government Building",
    "irregular area": "",
    "regular shape": ""
}


【Example 2】

Given JSON:
{
    "marker": {"content": ["Lingyin Temple"]},
    "dot": {
        "content": ["Hangzhou East Railway Station", "Jianqiao Airport"],
        "visualEncoding": ["color": "red", "size": 1]
    },
    "other icon": {}
    "direction": [
        {
        "id": 1,
        "name": "direction 1",
        "from": "Banshan Mountain",
        "to": "Hangzhou East Railway Station",
        "visualEncoding": {"color": "green", "strokeWidth": "1"}
        },
        {
        "id": 2,
        "name": "direction 2",
        "from": "Banshan Mountain",
        "to": "Jianqiao Airport",
        "visualEncoding": {"color": "yellow", "strokeWidth": "1"}
        }
    ],
    "line": {
        "content": ["Qiantang River", "Zhijiang Road"],
        "visualEncoding": {"color": "blue"}
    },
    "trajectory": [
        {
            "id": 1,
            "name": "trajectory 1",
            "sequence": [
                "the West Lake State Guesthouse",
                "Lingyin Temple",
                "Banshan Mountain",
                "the Civic Center",
                "the West Lake State Guesthouse"
            ],
            "visualEncoding": {
                "color": "pink",
                "strokeWidth": "1",
                "style": "solid"
            }
        }
        {
            "id": 2,
            "name": "trajectory 2",
            "sequence": [
                "the West Lake State Guesthouse",
                "Xixi Wetland"
            ],
            "visualEncoding": {
                "color": "green",
                "strokeWidth": "1",
                "style": "solid"
            }
        }
    ],
    "regular shape": [
        {
        "id": 1,
        "type": "circle",
        "center": "Jianqiao Airport",
        "radius": 10,
        "visualEncoding": {"color": "yellow", "opacity": 1}
        }
    ],
    "irregular area": {
        "content": ["Xixi Wetland"],
        "visualEncoding": {"color": "green", "strokeWidth": "1", "style": "solid"}
    }
}

Then you can output:
{
    "marker": "Use markers to mark the Lingyin Temple",
    "dot": "draw yellow dots for Hangzhou East Railway Station and Jianqiao Airport",
    "other icon": "",
    "direction": "Draw two directional arrows: one from Banshan Mountain to Hangzhou East Railway Station, and the other from Banshan Mountain to Jianqiao Airport",
    "line": "Draw the Qiantang River and Zhijiang Road",
    "trajectory": "Draw two trajectory:\nTrajectory 1 is connecting the West Lake State Guesthouse, Lingyin Temple, Banshan Mountain, the Civic Center, and the West Lake State Guesthouse.\nTrajectory 2 is connecting the West Lake State Guesthouse and Xixi Wetland",
    "regular shape": "Draw a yellow circle with a radius of 10km centered on Jianqiao Airport",
    "irregular area": "Use green to draw the area of ​​Xixi Wetland"
}


2. Output Format
[Requirement 1] The output format must strictly adhere to the JSON format, as in the above examples. In the output JSON, the value of each key (i.e., the geographic elements "marker", "dot", "other icon", "direction", "line", "trajectory", "regular shape", and "irregular area") must be a string (i.e., explanatory text). Please keep the explanatory statements for each geographic element concise, just like the examples provided.
[Requirement 2] Non-empty elements in the given JSON require explanatory text; empty elements do not, and you can simply provide an empty value as in the【Example 1】.



3. Your Task
Analyze the following given JSON, and generate the explanatory text in the JSON format like the above examples.
Given JSON: """+ str(json_result) + """
Output the explanatory text for every geographic element in JSON format:"""
    

    
    # print(prompt)

    messages = [
        {"role": "user", "content": prompt}
    ]
    

    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    

    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    

    response = tokenizer.decode(generated_ids[0][len(model_inputs.input_ids[0]):], skip_special_tokens=True)

    return response




def get_categorical_type(input_text: str, imported_data, model, tokenizer):
    prompt = """Role: You are an expert in geographical articles and geographical visualizations.
    Now there is a text containing geographic information. In order to realize geographic visualization of the text, I need to draw the place names mentioned in it on the map. Since not all place names have the same visual encoding, we need to give different place names different visual encodings according to the specific description of the text. However, some textual geovisualizations fall under our defined "categorical type".

1. Detailed descriptions of categorical type

Categorical involves assigning different visual encoding to different objects based on their categories (usually two categories). Objects of the same type are encoded consistently, while objects of different types are encoded differently. For example, if the text mentions that certain areas have one characteristic while other areas have another, different colors can be assigned to different regions on the map based on these categories. Another example is that when a travelogue describes the itinerary for the first day and the second day separately, the two trajectories can be encoded using different line types, thicknesses, or colors. Additionally, a news report might mention the disaster situations in several locations, with one particular place being the most severely affected. To give another example, news reports may introduce the US election and the voting situation in different states. If some states are in one category (e.g., red states) and some states are in another category (e.g., blue states), then states in different categories should use different visual codes, but states in the same category should use the same code.
Beyond these examples, for any given article, you should understand its semantics and categorize it accordingly.


2. Examples
【two examples for categorical】
Example 1 for categorical.
The text is "Several provinces across the country were affected by the typhoon, including Shanghai, Zhejiang, Jiangsu and Fujian, which were severely affected, but Guangdong and Hebei suffered minimal damage."
"Shanghai", "Zhejiang", "Jiangsu" and "Fujian", these areas are colored red on the map to highlight how badly they were hit.
"Guangdong" and "Hebei", these areas are colored green on the map to indicate they were least affected.
So the returned result must in JSON format, as shown below:
{
    "purpose": "categorical",
    "place_name1": ["Shanghai", "Zhejiang", "Jiangsu", "Fujian"],
    "color1": "red",
    "place_name2": ["Guangdong", "Hebei"], 
    "color2": "blue" 
}

Example 2 for categorical.
The text is "This shift has significantly impacted the electoral landscape. The latest poll from August 28 shows Harris surging ahead of Trump in Michigan and Wisconsin, reversing earlier deficits. We highlight these two states in yellow in the map. However, Republicans still maintain a slim advantage in states like Georgia and Arizona. Pennsylvania, highlighted in yellow on the map, has become a hotly contested battleground between Democrats and Republicans. This indicates the election's volatility and the crucial importance of every vote in this highly uncertain race."
If the text mentions the color of a place name or a category of place names, the JSON result should use. If the text does not mention the color of this category of place name, you can just recommend it based on the meaning of the text.
So the returned result must in JSON format, as shown below:
{
    "purpose": "categorical",
    "place_name1": ["Michigan", "Wisconsin"],
    "color1": "yellow",
    "place_name2": ["Georgia", "Arizona", "Pennsylvania"], 
    "color2": "red" 
}



3.Output Format
Your output can only be the final JSON result, without any explanation of the intermediate steps. Below are output format examples for categorical type：
{
    "purpose": "categorical",
    "place_name1": ["Michigan", "Wisconsin"],
    "color1": "yellow",
    "place_name2": ["Georgia", "Arizona", "Pennsylvania"], 
    "color2": "red" 
}

"""

    prompt += """ 
5. Your Task
Analyze the following text, and generate the output in the JSON format, without any additional explanations.
Text to Analyze: """ + input_text + """
Output:"""

    

    # print(prompt)


    messages = [
        {"role": "user", "content": prompt}
    ]
    

    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    

    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=1024,
            temperature=0.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    

    response = tokenizer.decode(generated_ids[0][len(model_inputs.input_ids[0]):], skip_special_tokens=True)

    return response

